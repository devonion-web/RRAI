import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpUploadFiles, rfpStoreText, rfpRemoveDocument,
  rfpCreatePack, rfpGetPack,
  rfpSaveProfile, rfpGetProfile,
  rfpDecompose,
  rfpGetRequirements, rfpConfirmOwnership,
  rfpRespond, rfpGetResponse,
  rfpUpdateBlock, rfpFillBlockPH, rfpMarkBlockReviewed,
  rfpAdvanceResponse, rfpReopenResponse,
} from './api.js'

// ── Brand ─────────────────────────────────────────────────────────────────────
const NAVY = '#0B1F3A', BLUE = '#1D4ED8', GREEN = '#16A34A'
const AMBER = '#D97706', RED = '#DC2626', PURPLE = '#7C3AED', ORANGE = '#EA580C'
const MUTED = '#64748B', BORDER = '#E2E8F0', WHITE = '#FFFFFF', BG = '#F8FAFC'
const DOC_NAVY = '06095A', DOC_CYAN = '13D4DB', DOC_LCYAN = 'E7FAFB', DOC_GRAY = '64748B', DOC_PURPLE = '3205B3'

const STATUS_META = {
  not_started: { label: 'Not started', bg: '#F1F5F9', text: MUTED },
  extracted:   { label: 'Brief ready', bg: '#DBEAFE', text: BLUE },
  drafted:     { label: 'Drafted',     bg: '#FEF9C3', text: AMBER },
  in_review:   { label: 'In review',   bg: '#EDE9FE', text: PURPLE },
  approved:    { label: 'Approved',    bg: '#D1FAE5', text: GREEN },
  reopened:    { label: 'Reopened',    bg: '#FFEDD5', text: ORANGE },
}
const EVENT_META = {
  pack_uploaded:        { icon: '📦', label: 'Pack uploaded' },
  section_detected:     { icon: '🔍', label: 'Sections detected' },
  brief_extracted:      { icon: '📋', label: 'Brief extracted' },
  draft_generated:      { icon: '✦',  label: 'Draft generated' },
  draft_edited:         { icon: '✏',  label: 'Draft saved' },
  placeholder_filled:   { icon: '✓',  label: 'Placeholder filled' },
  component_reviewed:   { icon: '◉',  label: 'Component reviewed' },
  status_changed:       { icon: '→',  label: 'Status changed' },
  approved:             { icon: '✅', label: 'Approved' },
  exported:             { icon: '⬇',  label: 'Exported' },
  reopened:             { icon: '↩',  label: 'Reopened' },
  profile_saved:        { icon: '👤', label: 'Profile saved' },
  decomposed:           { icon: '🔬', label: 'Document decomposed' },
  ownership_confirmed:  { icon: '✓',  label: 'Ownership confirmed' },
  ownership_overridden: { icon: '↺',  label: 'Ownership overridden' },
  response_generated:   { icon: '✦',  label: 'Response generated' },
  block_edited:         { icon: '✏',  label: 'Block edited' },
  block_reviewed:       { icon: '◉',  label: 'Block reviewed' },
  response_advanced:    { icon: '→',  label: 'Status advanced' },
  response_approved:    { icon: '✅', label: 'Response approved' },
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function countPH(v) {
  if (typeof v === 'string') return [...v.matchAll(/\{\{PLACEHOLDER:/g)].length + [...v.matchAll(/\{\{PH:/g)].length
  if (Array.isArray(v)) return v.reduce((n, x) => n + countPH(x), 0)
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + countPH(x), 0)
  return 0
}
function countUnfilledPH(draft) {
  if (!draft) return 0
  const phs = draft.placeholders || []
  if (phs.length > 0 && typeof phs[0] === 'object') return phs.filter(p => !p.filled).length
  return countPH(draft.components)
}
function scanForPlaceholders(v, ctx = '') {
  const out = []
  if (typeof v === 'string') {
    for (const m of [...v.matchAll(/\{\{PLACEHOLDER:\s*([^}]+?)\}\}/g)]) out.push({ key: m[1].trim(), placeholder: m[0], context: ctx })
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => out.push(...scanForPlaceholders(x, ctx || `item ${i + 1}`)))
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) out.push(...scanForPlaceholders(x, k))
  }
  return out
}
function applyToAll(v, ph, rep) {
  if (typeof v === 'string') return v.split(ph).join(rep)
  if (Array.isArray(v)) return v.map(x => applyToAll(x, ph, rep))
  if (v && typeof v === 'object') { const r = {}; for (const [k, x] of Object.entries(v)) r[k] = applyToAll(x, ph, rep); return r }
  return v
}
function timeAgo(ts) {
  const d = Date.now() - ts
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function normalizePlaceholders(draft) {
  const phs = draft?.placeholders || []
  if (!Array.isArray(phs) || phs.length === 0) return []
  if (typeof phs[0] === 'string') {
    return phs.map((desc, i) => ({ id: `ph_${String(i + 1).padStart(3, '0')}`, description: desc, group: null, value: null, filled: false }))
  }
  return phs
}

function parseInlineText(text, placeholders) {
  if (!text) return [{ type: 'text', value: '' }]
  const segments = []
  const re = /\{\{PH:([^}]+)\}\}|\{\{PLACEHOLDER:\s*([^}]+?)\}\}/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1]) {
      const ph = placeholders.find(p => p.id === m[1])
      segments.push({ type: 'ph', id: m[1], placeholder: ph || { id: m[1], description: m[1], filled: false, value: null, group: null } })
    } else {
      const desc = m[2].trim()
      const ph = placeholders.find(p => p.description === desc)
      segments.push({ type: 'ph', id: m[0], placeholder: ph || { id: m[0], description: desc, filled: false, value: null, group: null } })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

const COMP_NAMES  = ['understanding','approachAndRecommendedOption','deliveryPlan','domainComponent','resourcing','acceptanceGates','preWork','assumptions','configCustomisationThirdParty','costs','risks']
const COMP_LABELS = { understanding:'Understanding', approachAndRecommendedOption:'Approach', deliveryPlan:'Delivery Plan', domainComponent:'Domain', resourcing:'Resourcing', acceptanceGates:'Quality Gates', preWork:'Pre-Work', assumptions:'Assumptions', configCustomisationThirdParty:'Config / 3P', costs:'Costs', risks:'Risks' }

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
}
function Dot() { return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%' }} /> }
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.not_started
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: m.bg, color: m.text }}>{m.label}</span>
}
function VerdictBadge({ verdict }) {
  const c = { 'Complies': { bg: '#D1FAE5', text: GREEN }, 'Partially Complies': { bg: '#FEF9C3', text: AMBER }, 'Does Not Comply': { bg: '#FEE2E2', text: RED } }[verdict] || { bg: '#F1F5F9', text: MUTED }
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: c.bg, color: c.text }}>{verdict || 'Not set'}</span>
}
function ownerColor(owner) {
  if (owner === 'RR') return NAVY
  if (owner === 'LogicGate') return PURPLE
  if (owner === 'shared') return AMBER
  return MUTED
}
function OwnerBadge({ owner }) {
  const bg = ownerColor(owner)
  return (
    <span style={{ background: bg, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>
      {owner}
    </span>
  )
}
function SectionNum({ n }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n}</span>
}
function Block({ n, label, extra, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ background: NAVY, color: WHITE, padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        {n && <SectionNum n={n} />}{label}{extra}
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: WHITE, padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Inline PH components ──────────────────────────────────────────────────────
function PHChip({ ph, onFill, isActive }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(ph.value || '')
  useEffect(() => { if (isActive && !ph.filled) setEditing(true) }, [isActive, ph.filled])
  const chipId = 'ph-chip-' + ph.id.replace(/[^a-z0-9]/gi, '_')

  if (ph.filled) {
    return (
      <mark id={chipId} style={{ background: '#FFFBEB', color: '#78350F', borderBottom: '1px solid #FCD34D', borderRadius: 3, padding: '0 3px', fontStyle: 'italic' }}>
        {ph.value}
      </mark>
    )
  }
  if (editing) {
    return (
      <span id={chipId} style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle', margin: '0 2px' }}>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && val.trim()) { onFill(ph.id, val.trim()); setEditing(false) }
            if (e.key === 'Escape') setEditing(false)
          }}
          style={{ border: '1px solid #D97706', borderRadius: 4, padding: '2px 7px', fontSize: 12, width: 180, fontFamily: 'inherit', outline: 'none' }}
        />
        <button type="button" onClick={() => { if (val.trim()) { onFill(ph.id, val.trim()); setEditing(false) } }} disabled={!val.trim()}
          style={{ background: val.trim() ? '#D97706' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 4, padding: '2px 9px', fontSize: 12, fontWeight: 700, cursor: val.trim() ? 'pointer' : 'not-allowed' }}>✓</button>
        <button type="button" onClick={() => setEditing(false)}
          style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 4, padding: '2px 7px', fontSize: 12, cursor: 'pointer' }}>×</button>
      </span>
    )
  }
  return (
    <button id={chipId} type="button" onClick={() => setEditing(true)}
      style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: 12, padding: '1px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', verticalAlign: 'middle', margin: '0 2px' }}
      title={ph.description}>
      ✎ {ph.description}
    </button>
  )
}

function InlineAnswer({ text, placeholders, onFillPH, activePhId }) {
  if (!text) return <span style={{ color: MUTED, fontStyle: 'italic', fontSize: 12 }}>No content drafted.</span>
  const paras = text.split('\n')
  return (
    <div style={{ fontSize: 13, lineHeight: 1.75, color: '#1E293B' }}>
      {paras.map((para, pi) => {
        if (!para.trim()) return <div key={pi} style={{ height: 8 }} />
        const segments = parseInlineText(para, placeholders)
        return (
          <p key={pi} style={{ margin: '0 0 7px 0' }}>
            {segments.map((seg, si) =>
              seg.type === 'text'
                ? <span key={si}>{seg.value}</span>
                : <PHChip key={si} ph={seg.placeholder} isActive={activePhId === seg.id} onFill={onFillPH} />
            )}
          </p>
        )
      })}
    </div>
  )
}

function ComponentCard({ n, compKey, label, reqCtx, placeholders, reviewed, onMarkReviewed, children }) {
  const [mode, setMode] = useState('review')
  const compPHs       = placeholders.filter(p => p.group === compKey)
  const unfilledCount = compPHs.filter(p => !p.filled).length
  const canReview     = unfilledCount === 0
  const borderCol     = reviewed ? '#BBF7D0' : BORDER
  return (
    <div style={{ marginBottom: 18, border: `1px solid ${borderCol}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: NAVY, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {n !== undefined && <SectionNum n={n} />}
        <span style={{ color: WHITE, fontWeight: 700, fontSize: 12, flex: 1 }}>{label}</span>
        {reviewed && <span style={{ color: '#4ADE80', fontSize: 11, fontWeight: 700 }}>✓ Reviewed</span>}
        <button type="button" onClick={() => setMode(m => m === 'review' ? 'edit' : 'review')}
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: WHITE, padding: '2px 10px', fontSize: 11, cursor: 'pointer' }}>
          {mode === 'review' ? '✏ Edit' : '◉ Review'}
        </button>
      </div>
      {reqCtx && (
        <div style={{ background: '#F8FAFC', borderBottom: `1px solid ${BORDER}`, padding: '7px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3, flexShrink: 0, minWidth: 68 }}>Buyer asks</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>{reqCtx}</span>
        </div>
      )}
      <div style={{ background: WHITE, padding: '12px 14px' }}>
        {children({ mode })}
      </div>
      <div style={{ background: '#FAFBFC', borderTop: `1px solid ${BORDER}`, padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: unfilledCount > 0 ? AMBER : (compPHs.length > 0 ? GREEN : MUTED) }}>
          {unfilledCount > 0 ? `${unfilledCount} gap${unfilledCount !== 1 ? 's' : ''} to fill` : compPHs.length > 0 ? '✓ All gaps filled' : 'drafted'}
        </span>
        <button type="button" onClick={() => !reviewed && canReview && onMarkReviewed(compKey)}
          disabled={reviewed || !canReview}
          style={{ background: reviewed ? '#D1FAE5' : canReview ? NAVY : '#F1F5F9', color: reviewed ? GREEN : canReview ? WHITE : MUTED, border: reviewed ? `1px solid ${GREEN}` : 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: reviewed || !canReview ? 'not-allowed' : 'pointer' }}>
          {reviewed ? '✓ Reviewed' : canReview ? 'Mark reviewed' : 'Fill gaps first'}
        </button>
      </div>
    </div>
  )
}

function BlockCard({ n, block, onFillPH, onMarkReviewed, onSaveAnswer, activePhId }) {
  const [editing, setEditing]     = useState(false)
  const [localAnswer, setLocal]   = useState(block.answer)
  const [saving, setSaving]       = useState(false)
  const unfilled  = block.placeholders.filter(p => !p.filled).length
  const canReview = unfilled === 0
  const typeColor = block.type === 'minimum' ? BLUE : PURPLE
  const typeLabel = block.type === 'minimum' ? 'Min' : 'Enrichment'

  async function handleSave() {
    setSaving(true)
    await onSaveAnswer(block.key, localAnswer)
    setSaving(false); setEditing(false)
  }

  return (
    <div id={`block-${block.key}`} style={{ background: WHITE, border: `2px solid ${block.reviewed ? '#BBF7D0' : unfilled > 0 ? '#FDE68A' : BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: block.reviewed ? '#D1FAE5' : NAVY, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: typeColor, color: WHITE, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>{typeLabel}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: block.reviewed ? GREEN : WHITE, flex: 1 }}>Block {n}</span>
        {block.reviewed && <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>✓ Reviewed</span>}
        {unfilled > 0 && !block.reviewed && <span style={{ fontSize: 11, color: '#FDE68A', fontWeight: 600 }}>⚠ {unfilled} gap{unfilled !== 1 ? 's' : ''}</span>}
      </div>
      <div style={{ padding: '10px 14px', fontSize: 12, color: MUTED, fontStyle: 'italic', lineHeight: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, display: 'block', marginBottom: 4 }}>Buyer asks:</span>
        {block.prompt}
      </div>
      <div style={{ padding: 14 }}>
        {!editing
          ? <div onClick={() => setEditing(true)} style={{ cursor: 'text', minHeight: 40 }}>
              <InlineAnswer text={block.answer} placeholders={block.placeholders} onFillPH={(phId, val) => onFillPH(block.key, phId, val)} activePhId={activePhId} />
            </div>
          : <div>
              <textarea value={localAnswer} onChange={e => setLocal(e.target.value)} rows={6}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BLUE}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saving ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 5, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setLocal(block.answer) }}
                  style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '5px 12px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
        }
      </div>
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 10 }}>
        {canReview
          ? <button onClick={() => onMarkReviewed(block.key, !block.reviewed)}
              style={{ background: block.reviewed ? 'none' : GREEN, color: block.reviewed ? MUTED : WHITE, border: `1px solid ${block.reviewed ? BORDER : GREEN}`, borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {block.reviewed ? '↩ Un-review' : 'Mark reviewed ✓'}
            </button>
          : <span style={{ fontSize: 11, color: AMBER, fontWeight: 600 }}>Fill all gaps before reviewing</span>
        }
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{block.placeholders.length} placeholder{block.placeholders.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function TA({ value, onChange, rows = 4, yellow = false }) {
  const ph = typeof value === 'string' && (value.includes('{{PLACEHOLDER:') || value.includes('{{PH:'))
  return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', color: '#1E293B', background: (yellow || ph) ? '#FFFBEB' : '#FAFBFC' }}
    />
  )
}
function StringList({ items, onChange }) {
  return (
    <div>
      {(items || []).map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
          <span style={{ color: MUTED, fontSize: 12, paddingTop: 8, flexShrink: 0 }}>•</span>
          <textarea value={item} onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }} rows={2}
            style={{ flex: 1, padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4, background: (item.includes('{{PLACEHOLDER:') || item.includes('{{PH:')) ? '#FFFBEB' : WHITE }} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 16, paddingTop: 6 }}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...(items || []), ''])}
        style={{ fontSize: 11, color: BLUE, background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 4, padding: '4px 12px', cursor: 'pointer', width: '100%', marginTop: 4 }}>+ Add</button>
    </div>
  )
}
function InlineTable({ columns, rows, onChange }) {
  function updateCell(ri, key, val) { onChange(rows.map((r, i) => i === ri ? { ...r, [key]: val } : r)) }
  function addRow() { const e = {}; columns.forEach(c => e[c.key] = ''); onChange([...(rows || []), e]) }
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr>{columns.map(c => <th key={c.key} style={{ background: NAVY, color: WHITE, padding: '5px 8px', fontSize: 10, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', width: c.w }}>{c.label}</th>)}<th style={{ background: NAVY, width: 30 }} /></tr></thead>
          <tbody>
            {(rows || []).map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? WHITE : '#F8FAFC' }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: 3, verticalAlign: 'top' }}>
                    <textarea value={row[c.key] || ''} onChange={e => updateCell(i, c.key, e.target.value)} rows={c.rows || 2}
                      style={{ width: '100%', padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 3, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.4, background: ((row[c.key] || '').includes('{{PLACEHOLDER:') || (row[c.key] || '').includes('{{PH:')) ? '#FFFBEB' : 'transparent' }} />
                  </td>
                ))}
                <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '6px 4px' }}>
                  <button onClick={() => onChange((rows || []).filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} style={{ fontSize: 11, color: BLUE, background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 4, padding: '4px 12px', cursor: 'pointer', width: '100%', marginTop: 6 }}>+ Add row</button>
    </div>
  )
}

// ── Word export ───────────────────────────────────────────────────────────────
function dPara(text, opts = {}) {
  const { bold = false, color = '1F2937', size = 22, after = 80 } = opts
  return new Paragraph({ spacing: { after, line: 276 }, children: [new TextRun({ text: String(text || '').trim(), font: 'Arial', size, bold, color })] })
}
function dBullet(text) { return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: String(text || '').trim(), font: 'Arial', size: 22, color: '1F2937' })] }) }
function dH(label) { return new Paragraph({ spacing: { before: 240, after: 100 }, shading: { type: ShadingType.CLEAR, fill: DOC_NAVY }, children: [new TextRun({ text: `  ${label}`, font: 'Arial', size: 24, bold: true, color: 'FFFFFF' })] }) }
function dCallout(text) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: DOC_LCYAN }, margins: { top: 120, bottom: 120, left: 180, right: 180 }, borders: { left: { style: BorderStyle.THICK, size: 12, color: DOC_CYAN }, top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } }, children: [new Paragraph({ children: [new TextRun({ text: String(text || '').trim(), font: 'Arial', size: 20, color: DOC_NAVY, italics: true })] })] })] })] })
}
function dTable(headers, bodyRows) {
  const hRow = new TableRow({ tableHeader: true, children: headers.map(h => new TableCell({ shading: { type: ShadingType.CLEAR, fill: DOC_NAVY }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: h, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })] })] })) })
  const rows = bodyRows.map((cells, i) => new TableRow({ children: cells.map(cell => new TableCell({ shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: String(cell || '').trim(), font: 'Arial', size: 20, color: '1F2937' })] })] })) }))
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [hRow, ...rows] })
}
function dSpace() { return new Paragraph({ children: [new TextRun('')], spacing: { before: 60, after: 60 } }) }

async function exportSectionDocx({ buyer, sectionCode, sectionTitle, draft }) {
  const { components: c, complianceVerdict, openDependencies } = draft
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const ch = []
  ch.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'RFP Response — Commercial Lens', font: 'Arial', size: 44, bold: true, color: DOC_NAVY })] }))
  ch.push(dPara(buyer, { size: 32, bold: true, color: DOC_NAVY }))
  ch.push(dPara(`Section ${sectionCode}: ${sectionTitle}`, { size: 26, color: DOC_PURPLE }))
  ch.push(dPara(`Prepared by Risk Rising · ${today}`, { size: 20, color: DOC_GRAY, after: 120 }))
  ch.push(dCallout('DRAFT — FOR INTERNAL REVIEW ONLY. Not approved for release. Commercial lens: do not present as independent analyst content.'))
  ch.push(dSpace())
  ch.push(dH('Compliance Verdict')); ch.push(dPara(complianceVerdict || 'Not assessed', { bold: true, color: DOC_NAVY })); ch.push(dSpace())
  ch.push(dH('1. Understanding of the Challenge')); (c.understanding || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p))); ch.push(dSpace())
  ch.push(dH('2. Approach & Recommended Option')); (c.approachAndRecommendedOption || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p))); ch.push(dSpace())
  ch.push(dH('3. Delivery Plan')); (c.deliveryPlan?.narrative || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p)))
  if (c.deliveryPlan?.milestones?.length) { ch.push(dSpace()); ch.push(dTable(['Phase', 'Timing', 'Activities', 'Exit Criteria'], c.deliveryPlan.milestones.map(m => [m.phase, m.timing, m.activities, m.exit]))) }
  ch.push(dSpace())
  ch.push(dH(`4. Domain Component — ${c.domainComponent?.title || ''}`)); (c.domainComponent?.content || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p))); ch.push(dSpace())
  ch.push(dH('5. Resourcing'))
  if (c.resourcing?.deliveryTeam?.length) { ch.push(dTable(['Role', 'Responsibility', 'Phases'], c.resourcing.deliveryTeam.map(m => [m.role, m.responsibility, m.phases]))); ch.push(dSpace()) }
  if (c.resourcing?.buyerCommitment) { ch.push(dPara('Buyer-side commitment required:', { bold: true, color: DOC_NAVY })); ch.push(dCallout(c.resourcing.buyerCommitment)) }
  ch.push(dSpace())
  ch.push(dH('6. Acceptance & Quality Gates'))
  if (c.acceptanceGates?.length) ch.push(dTable(['Gate', 'Entry Criteria', 'Exit Criteria'], c.acceptanceGates.map(g => [g.gate, g.entry, g.exit]))); else ch.push(dPara('None defined.', { color: DOC_GRAY }))
  ch.push(dSpace())
  ch.push(dH('7. Pre-Work Required by Buyer'))
  if (c.preWork?.length) c.preWork.forEach(p => ch.push(dBullet(p))); else ch.push(dPara('None identified.', { color: DOC_GRAY }))
  ch.push(dSpace())
  ch.push(dH('8. Assumptions, Limitations & Dependencies'))
  if (c.assumptions?.length) ch.push(dCallout(c.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n')))
  ch.push(dSpace())
  ch.push(dH('9. Configuration / Customisation / Third-Party')); (c.configCustomisationThirdParty || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p))); ch.push(dSpace())
  ch.push(dH('10. Costs & Fit-Gaps')); (c.costs || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p))); ch.push(dSpace())
  ch.push(dH('11. Risks & Mitigations'))
  if (c.risks?.length) ch.push(dTable(['Risk', 'L×I', 'Mitigation', 'Owner'], c.risks.map(r => [r.risk, r.likelihoodImpact, r.mitigation, r.owner]))); else ch.push(dPara('None identified.', { color: DOC_GRAY }))
  if (openDependencies?.length) { ch.push(dSpace()); ch.push(dH('Open Dependencies / Clarification Questions')); openDependencies.forEach(d => ch.push(dBullet(d))) }
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Commercial lens — Risk Rising internal draft   ', font: 'Arial', size: 18, color: DOC_GRAY }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: DOC_GRAY })] })] })
  const doc = new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, footers: { default: footer }, children: ch }] })
  const blob = await Packer.toBlob(doc)
  const slug = `${buyer || 'RR'}-S${sectionCode}`.replace(/[\s.]+/g, '-')
  saveAs(blob, `RR-${slug}-${new Date().toISOString().slice(0, 10)}.docx`)
}

async function exportResponseDocx({ req, resp, buyer }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const resolveTokens = (text) => {
    let out = text || ''
    for (const block of resp.blocks) {
      for (const ph of block.placeholders) {
        if (ph.filled && ph.value) {
          out = out.split(`{{PH:${ph.id}}}`).join(ph.value)
        }
      }
    }
    return out
  }
  const ch = []
  ch.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'RFP Response — Commercial Lens', font: 'Arial', size: 44, bold: true, color: DOC_NAVY })] }))
  ch.push(dPara(buyer, { size: 32, bold: true, color: DOC_NAVY }))
  ch.push(dPara(`${req.code}: ${req.title}`, { size: 26, color: DOC_PURPLE }))
  if (req.scoringWeight) ch.push(dPara(`Scoring weight: ${req.scoringWeight}`, { size: 20, color: DOC_GRAY }))
  ch.push(dPara(`Prepared by Risk Rising · ${today}`, { size: 20, color: DOC_GRAY, after: 120 }))
  ch.push(dCallout('DRAFT — FOR INTERNAL REVIEW ONLY. Not approved for release. Commercial lens: do not present as independent analyst content.'))
  ch.push(dSpace())
  ch.push(dH('What the buyer asks for'))
  ;(req.sourceText || '').split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p, { color: DOC_GRAY })))
  ch.push(dSpace())
  const minBlocks = resp.blocks.filter(b => b.type === 'minimum')
  const enrBlocks = resp.blocks.filter(b => b.type === 'enrichment')
  if (minBlocks.length) {
    ch.push(dH('Minimum Requirement Responses'))
    minBlocks.forEach((b, i) => {
      ch.push(dPara(`${i + 1}. ${b.prompt}`, { bold: true, color: DOC_NAVY, size: 22, after: 40 }))
      resolveTokens(b.answer).split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p)))
      ch.push(dSpace())
    })
  }
  if (enrBlocks.length) {
    ch.push(dH('Additional Detail'))
    enrBlocks.forEach(b => {
      resolveTokens(b.answer).split(/\n+/).filter(Boolean).forEach(p => ch.push(dPara(p)))
      ch.push(dSpace())
    })
  }
  if (resp.openDependencies?.length) {
    ch.push(dH('Open Dependencies'))
    resp.openDependencies.forEach(d => ch.push(dBullet(d)))
  }
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Commercial lens — Risk Rising internal draft   ', font: 'Arial', size: 18, color: DOC_GRAY }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: DOC_GRAY })] })] })
  const doc  = new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, footers: { default: footer }, children: ch }] })
  const blob = await Packer.toBlob(doc)
  const slug = `${buyer || 'RR'}-${req.code}`.replace(/[\s.]+/g, '-')
  saveAs(blob, `RR-${slug}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── Setup screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onPack }) {
  const [buyer, setBuyer]       = useState('')
  const [packName, setPackName] = useState('')
  const [documents, setDocs]    = useState([])
  const [pasteText, setPaste]   = useState('')
  const [pasteName, setPasteName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState(null)
  const fileRef = useRef(null)

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData(); for (const f of files) fd.append('files', f)
      const { files: res } = await rfpUploadFiles(fd)
      setDocs(p => [...p, ...res.filter(r => r.id)])
      const errs = res.filter(r => r.error)
      if (errs.length) setError(errs.map(e => `${e.name}: ${e.error}`).join('\n'))
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }
  async function addPaste() {
    if (!pasteText.trim()) return
    setUploading(true); setError(null)
    try {
      const entry = await rfpStoreText({ name: pasteName.trim() || 'Pasted document', text: pasteText.trim() })
      setDocs(p => [...p, entry]); setPaste(''); setPasteName('')
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }
  async function create() {
    if (!documents.length || creating) return
    setCreating(true); setError(null)
    try {
      const pack = await rfpCreatePack({ name: packName.trim() || 'Bid Pack', buyer: buyer.trim() || 'Unknown', documentIds: documents.map(d => d.id) })
      onPack(pack)
    } catch (e) { setError(e.message); setCreating(false) }
  }
  const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}><div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>New Bid Pack</div><div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Upload the buyer's procurement files. RRAI will detect scored sections and guide you through each draft.</div></div>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '18px 22px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[['Buyer / Organisation', buyer, setBuyer, 'e.g. Marks & Spencer'], ['Pack Name', packName, setPackName, 'e.g. M&S GRC RFP 2026']].map(([label, val, set, ph]) => (
            <div key={label}><label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label><input value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} /></div>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paste document text</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <input value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder="Document name" style={{ ...inp, width: 'auto', flex: 1 }} />
            <button onClick={addPaste} disabled={!pasteText.trim() || uploading} style={{ background: pasteText.trim() && !uploading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() && !uploading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
          <textarea value={pasteText} onChange={e => setPaste(e.target.value)} rows={3} placeholder="Paste RFP content, evaluation framework, scope, or procurement instructions…" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        <div onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)) }} onDragOver={e => e.preventDefault()}
          style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10, marginBottom: documents.length ? 10 : 0 }}>
          <span>{uploading ? '⏳' : '📎'}</span>
          <span style={{ fontSize: 12, color: MUTED }}>{uploading ? 'Uploading…' : 'Drop files — PDF, Word, Excel, text'}</span>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Browse</button>
          <input ref={fileRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md" style={{ display: 'none' }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
        </div>
        {documents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {documents.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EAF1F8', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                <span>{d.fileType === 'excel' ? '📊' : '📄'}</span><span>{d.name}</span>
                <button onClick={() => { rfpRemoveDocument(d.id); setDocs(p => p.filter(x => x.id !== d.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={create} disabled={!documents.length || creating}
        style={{ width: '100%', background: documents.length && !creating ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: documents.length && !creating ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {creating ? <><Spinner /> Analysing pack…</> : '→ Analyse Bid Pack'}
      </button>
      {error && <div style={{ marginTop: 10, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div>
  )
}

// ── Profile screen ────────────────────────────────────────────────────────────
const ALL_REMIT_OPTIONS = ['implementation','delivery','data migration','training','change management','support','consulting','integration','testing','security','advisory']

function ProfileScreen({ pack, onProfile }) {
  const [ourRole, setOurRole]         = useState('delivery & consulting partner')
  const [primePartner, setPrime]       = useState('LogicGate')
  const [ourRemit, setOurRemit]       = useState(['implementation','delivery','data migration','training','change management','support','consulting'])
  const [otherParties, setOtherParties] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ourRemit.length) return
    setSaving(true); setError(null)
    try {
      const { profile } = await rfpSaveProfile(pack.id, {
        ourRole, primePartner, ourRemit,
        otherParties: otherParties.split(',').map(s => s.trim()).filter(Boolean),
      })
      onProfile(profile)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Step 1 of 3</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Engagement Profile</div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>Tell RRAI who is bidding and what Risk Rising owns. This drives ownership mapping across every requirement.</div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Risk Rising's Role in This Bid</label>
            <input value={ourRole} onChange={e => setOurRole(e.target.value)} required
              style={{ width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Prime / Lead Partner</label>
            <input value={primePartner} onChange={e => setPrime(e.target.value)} required
              style={{ width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Risk Rising's Remit <span style={{ color: RED }}>*</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {ALL_REMIT_OPTIONS.map(opt => {
                const on = ourRemit.includes(opt)
                return (
                  <button key={opt} type="button"
                    onClick={() => setOurRemit(p => on ? p.filter(r => r !== opt) : [...p, opt])}
                    style={{ background: on ? NAVY : 'none', color: on ? WHITE : MUTED, border: `1px solid ${on ? NAVY : BORDER}`, borderRadius: 16, padding: '4px 13px', fontSize: 12, cursor: 'pointer', fontWeight: on ? 700 : 400 }}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {ourRemit.length === 0 && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>Select at least one remit area.</div>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Other Named Parties (comma-separated, optional)</label>
            <input value={otherParties} onChange={e => setOtherParties(e.target.value)} placeholder="e.g. Panorays, AWS"
              style={{ width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          {error && <div style={{ color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>⚠ {error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving || !ourRemit.length}
              style={{ background: saving || !ourRemit.length ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: saving || !ourRemit.length ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save & decompose document →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Decompose screen ──────────────────────────────────────────────────────────
function DecomposeScreen({ pack, onRequirements }) {
  const [status, setStatus]     = useState('running')
  const [reqCount, setReqCount] = useState(null)
  const [error, setError]       = useState(null)

  function run() {
    setStatus('running'); setError(null)
    rfpDecompose(pack.id)
      .then(({ requirements }) => {
        setReqCount(requirements.length)
        setStatus('done')
        setTimeout(() => onRequirements(requirements), 900)
      })
      .catch(e => { setError(e.message); setStatus('error') })
  }

  useEffect(() => { run() }, [])

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      {status === 'running' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em' }}>Step 2 of 3</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><Spinner /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Decomposing bid document…</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>Reading the document, extracting requirements in order, and pre-classifying ownership. This takes 30–90 seconds.</div>
        </>
      )}
      {status === 'done' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, marginBottom: 8 }}>{reqCount} requirement{reqCount !== 1 ? 's' : ''} extracted</div>
          <div style={{ fontSize: 13, color: MUTED }}>Advancing to ownership mapping…</div>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: RED, marginBottom: 10 }}>Decomposition failed</div>
          <div style={{ fontSize: 12, color: RED, background: '#FEE2E2', padding: '10px 14px', borderRadius: 6, marginBottom: 18, textAlign: 'left' }}>{error}</div>
          <button onClick={run} style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺ Retry</button>
        </>
      )}
    </div>
  )
}

// ── Ownership mapping ─────────────────────────────────────────────────────────
const OWNERS = ['RR', 'LogicGate', 'shared', 'M&S']

function OwnerRow({ req, saving, onConfirm }) {
  const [owner, setOwner]         = useState(req.owner)
  const [rationale, setRationale] = useState(req.ownerRationale)
  const [editRat, setEditRat]     = useState(false)

  return (
    <div style={{ background: WHITE, border: `1px solid ${req.ownerConfirmed ? '#BBF7D0' : BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{req.code}</span>
            {req.scoringWeight && <span style={{ background: '#FEF9C3', color: AMBER, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{req.scoringWeight}</span>}
            {req.ownerConfirmed && <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>✓</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{req.title}</div>
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>Proposed owner</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {OWNERS.map(o => (
              <button key={o} type="button" onClick={() => setOwner(o)}
                style={{ background: owner === o ? ownerColor(o) : 'none', color: owner === o ? WHITE : MUTED, border: `1px solid ${owner === o ? ownerColor(o) : BORDER}`, borderRadius: 12, padding: '3px 9px', fontSize: 11, cursor: 'pointer', fontWeight: owner === o ? 700 : 400 }}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>Rationale</div>
          {editRat
            ? <input value={rationale} onChange={e => setRationale(e.target.value)} onBlur={() => setEditRat(false)} autoFocus
                style={{ width: '100%', padding: '5px 8px', border: `1px solid ${BLUE}`, borderRadius: 4, fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            : <div onClick={() => setEditRat(true)} style={{ fontSize: 12, color: MUTED, lineHeight: 1.4, cursor: 'pointer', fontStyle: 'italic' }}>{rationale || '—'}</div>
          }
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
          {!req.ownerConfirmed
            ? <button type="button" onClick={() => onConfirm(req, owner, rationale)} disabled={saving}
                style={{ background: saving ? '#CBD5E1' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {saving ? '…' : 'Confirm →'}
              </button>
            : <button type="button" onClick={() => onConfirm({ ...req, ownerConfirmed: false }, owner, rationale)}
                style={{ background: 'none', border: `1px solid ${MUTED}`, color: MUTED, borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                Override
              </button>
          }
        </div>
      </div>
    </div>
  )
}

function MappingScreen({ pack, requirements, onDone }) {
  const [reqs, setReqs]     = useState(requirements)
  const [saving, setSaving] = useState({})
  const [filter, setFilter] = useState('all')
  const confirmed           = reqs.filter(r => r.ownerConfirmed).length
  const allConfirmed        = confirmed === reqs.length

  async function confirm(req, owner, rationale) {
    setSaving(s => ({ ...s, [req.id]: true }))
    try {
      const { requirement: updated } = await rfpConfirmOwnership(req.id, { owner, ownerRationale: rationale, ownerConfirmed: true })
      setReqs(prev => prev.map(r => r.id === req.id ? { ...r, ...updated } : r))
    } catch {}
    setSaving(s => { const n = { ...s }; delete n[req.id]; return n })
  }

  async function confirmAll() {
    for (const req of reqs.filter(r => !r.ownerConfirmed)) {
      await confirm(req, req.owner, req.ownerRationale)
    }
  }

  const OWNER_FILTERS = ['all', 'RR', 'shared', 'LogicGate', 'M&S']
  const filtered = filter === 'all' ? reqs : reqs.filter(r => r.owner === filter)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 4 }}>Step 3 of 3</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Ownership Mapping</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Confirm or override RRAI's proposed ownership. {confirmed} / {reqs.length} confirmed.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={confirmAll} disabled={allConfirmed}
            style={{ background: 'none', border: `1px solid ${NAVY}`, color: NAVY, borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: allConfirmed ? 'not-allowed' : 'pointer', opacity: allConfirmed ? 0.4 : 1 }}>
            Accept all proposed →
          </button>
          <button onClick={() => onDone(reqs)} disabled={!allConfirmed}
            style={{ background: allConfirmed ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: allConfirmed ? 'pointer' : 'not-allowed' }}>
            Continue →
          </button>
        </div>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${reqs.length ? Math.round((confirmed / reqs.length) * 100) : 0}%`, background: GREEN, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {OWNER_FILTERS.map(f => {
          const count = f === 'all' ? reqs.length : reqs.filter(r => r.owner === f).length
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? NAVY : 'none', color: filter === f ? WHITE : MUTED, border: `1px solid ${filter === f ? NAVY : BORDER}`, borderRadius: 16, padding: '4px 13px', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
              {f === 'all' ? 'All' : f} ({count})
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(req => (
          <OwnerRow key={req.id} req={req} saving={!!saving[req.id]} onConfirm={confirm} />
        ))}
      </div>
    </div>
  )
}

// ── Dashboard screen ──────────────────────────────────────────────────────────
function DashboardScreen({ pack, profile, requirements, onRequirementsChange, onOpenReq, onReset }) {
  const [filter, setFilter]           = useState('working')
  const [respondingId, setResponding] = useState(null)
  const [errors, setErrors]           = useState({})

  const workingSet = requirements.filter(r => r.owner === 'RR' || r.owner === 'shared')
  const doneCount  = workingSet.filter(r => r.response?.status === 'approved').length
  const allDone    = workingSet.length > 0 && doneCount === workingSet.length
  const pct        = workingSet.length > 0 ? Math.round((doneCount / workingSet.length) * 100) : 0

  const FILTER_OPTS = ['working', 'all', 'RR', 'shared', 'LogicGate', 'M&S']
  const filtered =
    filter === 'all'     ? requirements :
    filter === 'working' ? workingSet :
    requirements.filter(r => r.owner === filter)

  async function generateResponse(req) {
    setResponding(req.id)
    setErrors(p => { const n = { ...p }; delete n[req.id]; return n })
    try {
      const { response } = await rfpRespond(req.id)
      onRequirementsChange(prev => prev.map(r => r.id === req.id ? { ...r, response } : r))
      onOpenReq({ ...req, response })
    } catch (e) {
      setErrors(p => ({ ...p, [req.id]: e.message }))
    }
    setResponding(null)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{pack.buyer}</div>
          <div style={{ fontSize: 13, color: MUTED }}>{pack.name} · {requirements.length} requirements</div>
          {profile && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>RR: {profile.ourRole} · Prime: {profile.primePartner}</div>}
        </div>
        <button onClick={onReset} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>+ New pack</button>
      </div>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Working set progress (RR + Shared)</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: allDone ? GREEN : NAVY }}>{doneCount} / {workingSet.length} approved</span>
        </div>
        <div style={{ height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GREEN : BLUE, borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        {allDone && <div style={{ marginTop: 8, fontSize: 12, color: GREEN, fontWeight: 600 }}>✓ All RR requirements approved — ready to export.</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_OPTS.map(f => {
          const count = f === 'working' ? workingSet.length : f === 'all' ? requirements.length : requirements.filter(r => r.owner === f).length
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? NAVY : 'none', color: filter === f ? WHITE : MUTED, border: `1px solid ${filter === f ? NAVY : BORDER}`, borderRadius: 16, padding: '4px 13px', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
              {f === 'working' ? 'Working set' : f === 'all' ? 'All' : f} ({count})
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(req => {
          const isWorking  = req.owner === 'RR' || req.owner === 'shared'
          const resp       = req.response
          const respStatus = resp?.status ?? null
          const isRes      = respondingId === req.id
          const phCount    = resp ? resp.blocks.flatMap(b => b.placeholders).filter(p => !p.filled).length : 0
          const unreviewed = resp ? resp.blocks.filter(b => b.type === 'minimum' && !b.reviewed).length : 0
          return (
            <div key={req.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', opacity: isWorking ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{req.code}</span>
                    <OwnerBadge owner={req.owner} />
                    {req.scoringWeight && <span style={{ background: '#FEF9C3', color: AMBER, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{req.scoringWeight}</span>}
                    {respStatus && <StatusBadge status={respStatus} />}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 3 }}>{req.title}</div>
                  {resp && (
                    <div style={{ fontSize: 11, color: phCount > 0 || unreviewed > 0 ? AMBER : GREEN }}>
                      {phCount > 0 ? `⚠ ${phCount} gap${phCount !== 1 ? 's' : ''}` : ''}
                      {phCount > 0 && unreviewed > 0 ? ' · ' : ''}
                      {unreviewed > 0 ? `${unreviewed} block${unreviewed !== 1 ? 's' : ''} to review` : ''}
                      {phCount === 0 && unreviewed === 0 ? `✓ ${resp.blocks.length} blocks ready` : ''}
                    </div>
                  )}
                  {errors[req.id] && <div style={{ fontSize: 11, color: RED, background: '#FEE2E2', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>⚠ {errors[req.id]}</div>}
                </div>
                {isWorking && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {!resp && !isRes && (
                      <button onClick={() => generateResponse(req)}
                        style={{ background: GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✦ Generate response
                      </button>
                    )}
                    {!resp && isRes && (
                      <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <Spinner /> Drafting… (~30 s)
                      </button>
                    )}
                    {resp && !isRes && (
                      <button onClick={() => onOpenReq(req)}
                        style={{ background: respStatus === 'approved' ? '#D1FAE5' : BLUE, color: respStatus === 'approved' ? GREEN : WHITE, border: respStatus === 'approved' ? `1px solid ${GREEN}` : 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {respStatus === 'approved' ? '✓ View approved →' : 'Open response →'}
                      </button>
                    )}
                    {resp && isRes && (
                      <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Spinner /> Re-drafting…
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Response screen ───────────────────────────────────────────────────────────
function ResponseScreen({ req, requirements, reqIdx, buyer, profile, onBack, onNavigate, onReqChanged }) {
  const [resp, setResp]         = useState(req.response || { blocks: [], status: 'draft', openDependencies: [] })
  const [generating, setGen]    = useState(false)
  const [genError, setGenErr]   = useState(null)
  const [activePhId, setActivePH] = useState(null)
  const [advancing, setAdv]     = useState(false)
  const [advError, setAdvErr]   = useState(null)

  function patchBlock(blockKey, updates) {
    setResp(prev => ({ ...prev, blocks: prev.blocks.map(b => b.key === blockKey ? { ...b, ...updates } : b) }))
  }

  async function generate() {
    setGen(true); setGenErr(null)
    try {
      const { response } = await rfpRespond(req.id)
      setResp(response)
      onReqChanged({ ...req, response })
    } catch (e) { setGenErr(e.message) }
    setGen(false)
  }

  async function handleFillPH(blockKey, phId, value) {
    const block = resp.blocks.find(b => b.key === blockKey)
    if (!block) return
    patchBlock(blockKey, { placeholders: block.placeholders.map(p => p.id === phId ? { ...p, value, filled: true } : p) })
    await rfpFillBlockPH(req.id, blockKey, phId, value).catch(() => {})
    setActivePH(null)
  }

  async function handleMarkReviewed(blockKey, reviewed) {
    patchBlock(blockKey, { reviewed })
    await rfpMarkBlockReviewed(req.id, blockKey, reviewed).catch(() => {})
  }

  async function handleSaveAnswer(blockKey, answer) {
    patchBlock(blockKey, { answer })
    await rfpUpdateBlock(req.id, blockKey, answer).catch(() => {})
  }

  async function handleAdvance() {
    setAdv(true); setAdvErr(null)
    try {
      const { response: updated } = await rfpAdvanceResponse(req.id)
      setResp(updated)
      onReqChanged({ ...req, response: updated })
    } catch (e) { setAdvErr(e.message) }
    setAdv(false)
  }

  async function handleReopen() {
    try {
      const { response: updated } = await rfpReopenResponse(req.id)
      setResp(updated)
      onReqChanged({ ...req, response: updated })
    } catch {}
  }

  const minBlocks     = resp.blocks.filter(b => b.type === 'minimum')
  const enrBlocks     = resp.blocks.filter(b => b.type === 'enrichment')
  const totalPH       = resp.blocks.flatMap(b => b.placeholders)
  const unfilledPH    = totalPH.filter(p => !p.filled)
  const unreviewedMin = minBlocks.filter(b => !b.reviewed)
  const canApprove    = unfilledPH.length === 0 && unreviewedMin.length === 0 && resp.status !== 'approved'
  const navPrev       = reqIdx > 0 ? requirements[reqIdx - 1] : null
  const navNext       = reqIdx < requirements.length - 1 ? requirements[reqIdx + 1] : null
  const gapList       = resp.blocks.flatMap(b => b.placeholders.filter(p => !p.filled).map(p => ({ ...p, blockKey: b.key })))

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: NAVY, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '4px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← Dashboard</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{req.code}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: WHITE, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.title}</span>
        <OwnerBadge owner={req.owner} />
        {req.scoringWeight && <span style={{ background: '#FEF9C3', color: AMBER, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{req.scoringWeight}</span>}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => navPrev && onNavigate(navPrev)} disabled={!navPrev}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: WHITE, padding: '4px 9px', fontSize: 11, cursor: navPrev ? 'pointer' : 'not-allowed', opacity: navPrev ? 1 : 0.35 }}>‹</button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '0 2px' }}>{reqIdx + 1}/{requirements.length}</span>
          <button onClick={() => navNext && onNavigate(navNext)} disabled={!navNext}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: WHITE, padding: '4px 9px', fontSize: 11, cursor: navNext ? 'pointer' : 'not-allowed', opacity: navNext ? 1 : 0.35 }}>›</button>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>What {buyer || 'the buyer'} asks for</div>
            <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>{req.sourceText}</div>
          </div>

          {!resp.blocks.length && !generating && (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6 }}>No response yet</div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Generate a minimum-first response — one block per minimum expectation.</div>
              <button onClick={generate} style={{ background: GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✦ Generate response</button>
              {genError && <div style={{ color: RED, fontSize: 12, marginTop: 10 }}>⚠ {genError}</div>}
            </div>
          )}
          {generating && (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 16, display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', color: MUTED }}>
              <Spinner /> Generating minimum-first response… (30–90 s)
            </div>
          )}

          {minBlocks.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 10, letterSpacing: '0.04em' }}>Minimum requirements ({minBlocks.length} blocks)</div>
              {minBlocks.map((block, i) => (
                <BlockCard key={block.key} n={i + 1} block={block}
                  onFillPH={handleFillPH} onMarkReviewed={handleMarkReviewed} onSaveAnswer={handleSaveAnswer} activePhId={activePhId} />
              ))}
            </>
          )}
          {enrBlocks.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 10, marginTop: 20, letterSpacing: '0.04em' }}>Enrichment blocks ({enrBlocks.length})</div>
              {enrBlocks.map((block, i) => (
                <BlockCard key={block.key} n={i + 1} block={block}
                  onFillPH={handleFillPH} onMarkReviewed={handleMarkReviewed} onSaveAnswer={handleSaveAnswer} activePhId={activePhId} />
              ))}
            </>
          )}

          {resp.openDependencies?.length > 0 && (
            <div style={{ background: '#FFFBEB', border: `1px solid ${AMBER}`, borderRadius: 8, padding: 14, marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, textTransform: 'uppercase', marginBottom: 6 }}>Open dependencies</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {resp.openDependencies.map((d, i) => <li key={i} style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>{d}</li>)}
              </ul>
            </div>
          )}

          {resp.blocks.length > 0 && (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {resp.status !== 'approved' && (
                <>
                  <button onClick={handleAdvance} disabled={!canApprove || advancing}
                    style={{ background: canApprove && !advancing ? GREEN : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: canApprove && !advancing ? 'pointer' : 'not-allowed' }}>
                    {advancing ? 'Advancing…' : resp.status === 'in_review' ? 'Approve response ✓' : 'Submit for review →'}
                  </button>
                  {advError && <span style={{ fontSize: 12, color: RED }}>{advError}</span>}
                  {!canApprove && !advError && (
                    <span style={{ fontSize: 12, color: MUTED }}>
                      {unfilledPH.length > 0 ? `${unfilledPH.length} gap${unfilledPH.length !== 1 ? 's' : ''} to fill` : ''}
                      {unfilledPH.length > 0 && unreviewedMin.length > 0 ? ' · ' : ''}
                      {unreviewedMin.length > 0 ? `${unreviewedMin.length} block${unreviewedMin.length !== 1 ? 's' : ''} to review` : ''}
                    </span>
                  )}
                </>
              )}
              {resp.status === 'approved' && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Response approved</span>
                  <button onClick={handleReopen} style={{ background: 'none', border: `1px solid ${MUTED}`, color: MUTED, borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>↩ Reopen</button>
                  <button onClick={() => exportResponseDocx({ req, resp, buyer })}
                    style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
                    ⬇ Export .docx
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 260, borderLeft: `1px solid ${BORDER}`, background: WHITE, overflowY: 'auto', padding: 16, flexShrink: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Status</div>
            <StatusBadge status={resp.status || 'draft'} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
              Gaps to fill {gapList.length > 0 && <span style={{ background: AMBER, color: WHITE, borderRadius: 8, padding: '1px 6px', fontSize: 9, marginLeft: 4 }}>{gapList.length}</span>}
            </div>
            {gapList.length === 0
              ? <div style={{ fontSize: 12, color: GREEN }}>✓ No gaps remaining</div>
              : gapList.map(ph => (
                  <div key={ph.id} style={{ marginBottom: 8, padding: '6px 10px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#92400E', marginBottom: 3 }}>{ph.description}</div>
                    <button onClick={() => {
                        setActivePH(ph.id)
                        document.getElementById(`block-${ph.blockKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      style={{ fontSize: 10, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↗ Jump to block</button>
                  </div>
                ))
            }
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
              Block review {unreviewedMin.length === 0 && minBlocks.length > 0 && <span style={{ color: GREEN }}>✓</span>}
            </div>
            {minBlocks.map((b, i) => (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: b.reviewed ? GREEN : BORDER }}>●</span>
                <span style={{ fontSize: 12, color: b.reviewed ? GREEN : MUTED, fontWeight: b.reviewed ? 600 : 400 }}>Block {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'rfp_pack_id'

export default function RFPModule({ onBack }) {
  const [screen, setScreen]             = useState('setup')
  const [pack, setPack]                 = useState(null)
  const [profile, setProfile]           = useState(null)
  const [requirements, setRequirements] = useState([])
  const [currentReq, setCurrentReq]     = useState(null)
  const [currentIdx, setCurrentIdx]     = useState(0)
  const [recovering, setRecovering]     = useState(false)

  useEffect(() => {
    const storedId = sessionStorage.getItem(SESSION_KEY)
    if (!storedId) return
    setRecovering(true)
    Promise.all([
      rfpGetPack(storedId),
      rfpGetProfile(storedId).catch(() => null),
      rfpGetRequirements(storedId).catch(() => ({ requirements: [] })),
    ]).then(([packData, profileData, reqData]) => {
      setPack(packData)
      if (profileData?.profile) setProfile(profileData.profile)
      else if (profileData && !profileData.error) setProfile(profileData)
      const reqs = reqData?.requirements ?? []
      setRequirements(reqs)
      if (reqs.length > 0) {
        setScreen(reqs.every(r => r.ownerConfirmed) ? 'dashboard' : 'mapping')
      } else {
        setScreen('profile')
      }
    })
    .catch(() => sessionStorage.removeItem(SESSION_KEY))
    .finally(() => setRecovering(false))
  }, [])

  function handlePack(p)         { sessionStorage.setItem(SESSION_KEY, p.id); setPack(p); setScreen('profile') }
  function handleProfile(p)      { setProfile(p); setScreen('decompose') }
  function handleRequirements(r) { setRequirements(r); setScreen('mapping') }
  function handleMappingDone(r)  { setRequirements(r); setScreen('dashboard') }
  function handleReset() {
    sessionStorage.removeItem(SESSION_KEY)
    setPack(null); setProfile(null); setRequirements([]); setCurrentReq(null); setScreen('setup')
  }

  function openReq(req) {
    const latest = requirements.find(r => r.id === req.id) || req
    const idx    = requirements.findIndex(r => r.id === latest.id)
    setCurrentReq(latest); setCurrentIdx(idx >= 0 ? idx : 0); setScreen('respond')
  }

  function handleNavigate(targetReq) {
    const latest = requirements.find(r => r.id === targetReq.id) || targetReq
    const idx    = requirements.findIndex(r => r.id === latest.id)
    if (latest.response) {
      setCurrentReq(latest); setCurrentIdx(idx >= 0 ? idx : 0)
    } else {
      setScreen('dashboard')
    }
  }

  function handleReqChanged(updated) {
    setRequirements(prev => prev.map(r => r.id === updated.id ? updated : r))
    setCurrentReq(updated)
  }

  const STEPS = [['profile','Profile'],['decompose','Decompose'],['mapping','Mapping'],['dashboard','Dashboard']]

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {screen !== 'respond' && (
        <div style={{ background: NAVY, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← RAI Home</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP Response Drafter</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Commercial lens</span>
          {pack && (screen === 'dashboard' || screen === 'mapping') && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>/ {pack.buyer}</span>}
          {pack && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {STEPS.map(([s, label]) => (
                <span key={s} style={{ fontSize: 11, fontWeight: 600, color: screen === s ? WHITE : 'rgba(255,255,255,0.3)' }}>{label}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {recovering && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10, color: MUTED, fontSize: 13 }}>
          <Spinner /> Restoring your session…
        </div>
      )}
      {!recovering && screen === 'setup'     && <SetupScreen onPack={handlePack} />}
      {!recovering && screen === 'profile'   && pack && <ProfileScreen pack={pack} onProfile={handleProfile} />}
      {!recovering && screen === 'decompose' && pack && <DecomposeScreen pack={pack} onRequirements={handleRequirements} />}
      {!recovering && screen === 'mapping'   && pack && requirements.length > 0 && (
        <MappingScreen pack={pack} requirements={requirements} onDone={handleMappingDone} />
      )}
      {!recovering && screen === 'dashboard' && pack && (
        <DashboardScreen
          pack={pack}
          profile={profile}
          requirements={requirements}
          onRequirementsChange={setRequirements}
          onOpenReq={openReq}
          onReset={handleReset}
        />
      )}
      {screen === 'respond' && currentReq && (
        <ResponseScreen
          key={currentReq.id}
          req={currentReq}
          requirements={requirements}
          reqIdx={currentIdx}
          buyer={pack?.buyer}
          profile={profile}
          onBack={() => setScreen('dashboard')}
          onNavigate={handleNavigate}
          onReqChanged={handleReqChanged}
        />
      )}
    </div>
  )
}

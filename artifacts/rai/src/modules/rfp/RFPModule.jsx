import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpUploadFiles, rfpStoreText, rfpRemoveDocument,
  rfpCreatePack, rfpDetectSections,
  rfpExtractBrief, rfpGenerateDraft, rfpUpdateDraft,
  rfpAdvanceDraftStatus, rfpReopenDraft,
  rfpGetSectionAudit,
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
  pack_uploaded:    { icon: '📦', label: 'Pack uploaded' },
  section_detected: { icon: '🔍', label: 'Sections detected' },
  brief_extracted:  { icon: '📋', label: 'Brief extracted' },
  draft_generated:  { icon: '✦',  label: 'Draft generated' },
  draft_edited:     { icon: '✏', label: 'Draft saved' },
  placeholder_filled: { icon: '✓', label: 'Placeholder filled' },
  status_changed:   { icon: '→', label: 'Status changed' },
  approved:         { icon: '✅', label: 'Approved' },
  exported:         { icon: '⬇', label: 'Exported' },
  reopened:         { icon: '↩', label: 'Reopened' },
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function countPH(v) {
  if (typeof v === 'string') return [...v.matchAll(/\{\{PLACEHOLDER:/g)].length
  if (Array.isArray(v)) return v.reduce((n, x) => n + countPH(x), 0)
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + countPH(x), 0)
  return 0
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
function detectPlaceholders(components) {
  const seen = new Set()
  return scanForPlaceholders(components).filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true })
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
function TA({ value, onChange, rows = 4, yellow = false }) {
  const ph = typeof value === 'string' && value.includes('{{PLACEHOLDER:')
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
            style={{ flex: 1, padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4, background: item.includes('{{PLACEHOLDER:') ? '#FFFBEB' : WHITE }} />
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
                      style={{ width: '100%', padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 3, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.4, background: (row[c.key] || '').includes('{{PLACEHOLDER:') ? '#FFFBEB' : 'transparent' }} />
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

// ── Dashboard screen ──────────────────────────────────────────────────────────
function DashboardScreen({ pack, sections, onSectionsChange, onOpenSection, onReset }) {
  const [detecting, setDetecting] = useState(false)
  const [briefLoading, setBriefLoading] = useState(null)
  const [draftLoading, setDraftLoading] = useState(null)
  const [detectError, setDetectError] = useState(null)
  // Per-section errors so a failed card doesn't displace unrelated content
  const [cardErrors, setCardErrors] = useState({})

  function clearCardError(id) { setCardErrors(p => { const n = { ...p }; delete n[id]; return n }) }
  function setCardError(id, msg) { setCardErrors(p => ({ ...p, [id]: msg })) }

  useEffect(() => { if (!sections.length) detect() }, [])

  async function detect() {
    setDetecting(true); setDetectError(null)
    try { const { sections: s } = await rfpDetectSections(pack.id); onSectionsChange(s || []) }
    catch (e) { setDetectError(e.message) }
    finally { setDetecting(false) }
  }

  async function extractBrief(section) {
    setBriefLoading(section.id); clearCardError(section.id)
    try {
      const { section: updated } = await rfpExtractBrief(section.id)
      // Functional update avoids stale-closure overwrite from concurrent state changes
      onSectionsChange(prev => prev.map(s => s.id === section.id ? updated : s))
    } catch (e) { setCardError(section.id, e.message) }
    finally { setBriefLoading(null) }
  }

  async function generateDraft(section) {
    setDraftLoading(section.id); clearCardError(section.id)
    try {
      const { draft, sectionStatus } = await rfpGenerateDraft(section.id)
      const updated = { ...section, draft, status: sectionStatus || 'drafted' }
      onSectionsChange(prev => prev.map(s => s.id === section.id ? updated : s))
      setDraftLoading(null)
      onOpenSection(updated)
    } catch (e) {
      setCardError(section.id, e.message)
      setDraftLoading(null)
    }
  }

  const approved    = sections.filter(s => s.status === 'approved').length
  const total       = sections.length
  const allApproved = total > 0 && approved === total
  const pct         = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
      {/* Pack header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{pack.buyer}</div>
          <div style={{ fontSize: 13, color: MUTED }}>{pack.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={detect} disabled={detecting} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>↺ Re-detect</button>
          <button onClick={onReset} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>+ New pack</button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Pack progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: allApproved ? GREEN : NAVY }}>{approved} / {total} sections approved {allApproved ? '✓' : ''}</span>
          </div>
          <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: allApproved ? GREEN : BLUE, borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          {allApproved && <div style={{ marginTop: 8, fontSize: 12, color: GREEN, fontWeight: 600 }}>✓ All sections approved — export each via the section editor.</div>}
        </div>
      )}

      {detectError && <div style={{ marginBottom: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{detectError}</div>}
      {detecting && <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>🔍 Detecting scored response sections…</div>}

      {!detecting && sections.length === 0 && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>No scored sections detected.</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Try pasting the scored question section directly, then re-detect.</div>
          <button onClick={detect} style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↺ Try again</button>
        </div>
      )}

      {/* Section grid */}
      {sections.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {sections.map((s, idx) => {
            const meta   = STATUS_META[s.status] || STATUS_META.not_started
            const phCount = s.draft ? countPH(s.draft.components) : 0
            const isBL   = briefLoading === s.id
            const isDL   = draftLoading === s.id
            return (
              <div key={s.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{s.code}</span>
                  {s.scoringWeight && <span style={{ background: '#FEF9C3', color: AMBER, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{s.scoringWeight}</span>}
                  <span style={{ marginLeft: 'auto' }}><StatusBadge status={s.status} /></span>
                  <span style={{ fontSize: 11, color: MUTED, background: '#F1F5F9', borderRadius: 4, padding: '1px 6px', minWidth: 20, textAlign: 'center' }}>{idx + 1}</span>
                </div>
                {/* Title */}
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{s.title}</div>
                {/* Summary */}
                {s.summary && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{s.summary}</div>}
                {/* Placeholder status */}
                {s.draft && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: phCount > 0 ? AMBER : GREEN }}>
                    {phCount > 0 ? `⚠ ${phCount} placeholder${phCount !== 1 ? 's' : ''} unfilled` : '✓ All placeholders filled'}
                  </div>
                )}
                {/* Last updated */}
                {s.draft && <div style={{ fontSize: 11, color: MUTED }}>Updated {timeAgo(s.draft.updatedAt)}</div>}
                {/* Per-card error + Retry */}
                {cardErrors[s.id] && (
                  <div style={{ fontSize: 11, color: RED, background: '#FEE2E2', padding: '6px 10px', borderRadius: 6, lineHeight: 1.4 }}>
                    ⚠ {cardErrors[s.id]}
                  </div>
                )}
                {/* Action */}
                <div style={{ marginTop: 4 }}>
                  {(s.status === 'not_started' || (s.status === 'not_started' && cardErrors[s.id])) && !isBL && (
                    <button onClick={() => extractBrief(s)} style={{ width: '100%', background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {cardErrors[s.id] ? '↺ Retry extraction' : 'Extract brief'}
                    </button>
                  )}
                  {s.status === 'not_started' && isBL && (
                    <button disabled style={{ width: '100%', background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> Extracting…</button>
                  )}
                  {s.status === 'extracted' && !isDL && (
                    <button onClick={() => generateDraft(s)} style={{ width: '100%', background: cardErrors[s.id] ? AMBER : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {cardErrors[s.id] ? '↺ Retry draft' : '✦ Generate draft'}
                    </button>
                  )}
                  {s.status === 'extracted' && isDL && (
                    <button disabled style={{ width: '100%', background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> Drafting… (this can take ~30 s)</button>
                  )}
                  {['drafted', 'in_review', 'approved', 'reopened'].includes(s.status) && (
                    <button onClick={() => onOpenSection(s)} style={{ width: '100%', background: s.status === 'approved' ? '#D1FAE5' : BLUE, color: s.status === 'approved' ? GREEN : WHITE, border: s.status === 'approved' ? `1px solid ${GREEN}` : 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {s.status === 'approved' ? '✓ View approved →' : 'Open draft →'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Draft screen ──────────────────────────────────────────────────────────────
function DraftScreen({ section, sections, currentIdx, buyer, onBack, onNavigate, onSectionChanged }) {
  const d = section.draft
  const [comp, setComp]         = useState(d?.components || {})
  const [verdict, setVerdict]   = useState(d?.complianceVerdict || 'Partially Complies')
  const [openDeps, setOpenDeps] = useState(d?.openDependencies || [])
  const [status, setStatus]     = useState(d?.status || 'draft')
  const [sectionStatus, setSectionStatus] = useState(section.status || 'drafted')
  const [phValues, setPhValues] = useState({})
  const [dirty, setDirty]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [advancing, setAdv]     = useState(false)
  const [reopening, setReop]    = useState(false)
  const [exporting, setExp]     = useState(false)
  const [exportErr, setExpErr]  = useState(null)
  const [history, setHistory]   = useState([])
  const [advErr, setAdvErr]     = useState(null)

  const placeholders  = detectPlaceholders(comp)
  const unfilledCount = placeholders.filter(p => !phValues[p.key]?.trim()).length

  useEffect(() => {
    rfpGetSectionAudit(section.id).then(({ events }) => setHistory([...(events || [])].reverse())).catch(() => {})
  }, [section.id])

  async function refreshHistory() {
    try { const { events } = await rfpGetSectionAudit(section.id); setHistory([...(events || [])].reverse()) } catch {}
  }

  function set(field, val) { setComp(p => ({ ...p, [field]: val })); setDirty(true) }
  function setDP(field, val) { setComp(p => ({ ...p, deliveryPlan: { ...p.deliveryPlan, [field]: val } })); setDirty(true) }
  function setDC(field, val) { setComp(p => ({ ...p, domainComponent: { ...p.domainComponent, [field]: val } })); setDirty(true) }
  function setRes(field, val) { setComp(p => ({ ...p, resourcing: { ...p.resourcing, [field]: val } })); setDirty(true) }
  function setF(field) { return v => set(field, v) }

  function applyPh(key, placeholder, value) {
    if (!value?.trim()) return
    setComp(prev => applyToAll(prev, placeholder, value))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const { draft } = await rfpUpdateDraft(section.id, { components: comp, complianceVerdict: verdict, openDependencies: openDeps })
      onSectionChanged({ sectionId: section.id, draft })
      setDirty(false)
      await refreshHistory()
    } catch {}
    setSaving(false)
  }

  async function advance() {
    if (dirty) await save()
    setAdv(true); setAdvErr(null)
    try {
      const resp = await rfpAdvanceDraftStatus(section.id)
      setStatus(resp.draft.status)
      setSectionStatus(resp.sectionStatus || sectionStatus)
      onSectionChanged({ sectionId: section.id, draft: resp.draft, sectionStatus: resp.sectionStatus })
      await refreshHistory()
    } catch (e) { setAdvErr(e.message) }
    setAdv(false)
  }

  async function reopen() {
    setReop(true)
    try {
      const resp = await rfpReopenDraft(section.id)
      setStatus(resp.draft.status)
      setSectionStatus(resp.sectionStatus)
      onSectionChanged({ sectionId: section.id, draft: resp.draft, sectionStatus: resp.sectionStatus })
      await refreshHistory()
    } catch {}
    setReop(false)
  }

  async function doExport() {
    if (dirty) await save()
    setExp(true); setExpErr(null)
    try { await exportSectionDocx({ buyer, sectionCode: section.code, sectionTitle: section.title, draft: { components: comp, complianceVerdict: verdict, openDependencies: openDeps } }) }
    catch (e) { setExpErr(e.message) }
    setExp(false)
  }

  async function navigateTo(targetSection) {
    if (dirty) await save()
    onNavigate(targetSection)
  }

  const prevSection = currentIdx > 0 ? sections[currentIdx - 1] : null
  const nextSection = currentIdx < sections.length - 1 ? sections[currentIdx + 1] : null

  const MILESTONES_COLS = [{ key: 'phase', label: 'Phase', w: '15%', rows: 2 }, { key: 'timing', label: 'Timing', w: '15%', rows: 2 }, { key: 'activities', label: 'Activities', w: '45%', rows: 3 }, { key: 'exit', label: 'Exit criteria', w: '25%', rows: 3 }]
  const TEAM_COLS       = [{ key: 'role', label: 'Role', w: '20%', rows: 2 }, { key: 'responsibility', label: 'Responsibility', w: '55%', rows: 3 }, { key: 'phases', label: 'Phases', w: '25%', rows: 2 }]
  const GATES_COLS      = [{ key: 'gate', label: 'Gate', w: '20%', rows: 2 }, { key: 'entry', label: 'Entry criteria', w: '40%', rows: 3 }, { key: 'exit', label: 'Exit criteria', w: '40%', rows: 3 }]
  const RISKS_COLS      = [{ key: 'risk', label: 'Risk', w: '30%', rows: 3 }, { key: 'likelihoodImpact', label: 'L×I', w: '10%', rows: 2 }, { key: 'mitigation', label: 'Mitigation', w: '40%', rows: 3 }, { key: 'owner', label: 'Owner', w: '20%', rows: 2 }]
  const VERDICTS        = ['Complies', 'Partially Complies', 'Does Not Comply']
  const VCOLS           = { 'Complies': GREEN, 'Partially Complies': AMBER, 'Does Not Comply': RED }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← Dashboard</button>
        {/* Prev/next navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => prevSection && navigateTo(prevSection)} disabled={!prevSection}
            style={{ background: prevSection ? 'rgba(255,255,255,0.12)' : 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: prevSection ? WHITE : 'rgba(255,255,255,0.3)', padding: '3px 8px', fontSize: 13, cursor: prevSection ? 'pointer' : 'not-allowed' }} title={prevSection ? `← ${prevSection.code}` : ''}>‹</button>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{currentIdx + 1} / {sections.length}</span>
          <button onClick={() => nextSection && navigateTo(nextSection)} disabled={!nextSection}
            style={{ background: nextSection ? 'rgba(255,255,255,0.12)' : 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: nextSection ? WHITE : 'rgba(255,255,255,0.3)', padding: '3px 8px', fontSize: 13, cursor: nextSection ? 'pointer' : 'not-allowed' }} title={nextSection ? `${nextSection.code} →` : ''}>›</button>
        </div>
        <VerdictBadge verdict={verdict} />
        <span style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>{section.code} — {section.title}</span>
        {section.scoringWeight && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{section.scoringWeight}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={sectionStatus} />
          {dirty && <button onClick={save} disabled={saving} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>
      {/* Disclaimer */}
      <div style={{ background: '#FEF9C3', borderBottom: `1px solid ${AMBER}`, padding: '5px 24px', fontSize: 11, color: '#92400E', fontWeight: 600 }}>
        ⚠ Commercial lens — internal draft only. Human approval required before export.
      </div>

      <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto' }}>
        {/* Main editor */}
        <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
          {/* Compliance verdict */}
          <Block label="Compliance Verdict">
            <div style={{ display: 'flex', gap: 8 }}>
              {VERDICTS.map(v => (
                <button key={v} onClick={() => { setVerdict(v); setDirty(true) }}
                  style={{ flex: 1, padding: '8px 0', border: `2px solid ${verdict === v ? VCOLS[v] : BORDER}`, borderRadius: 6, background: verdict === v ? VCOLS[v] + '18' : 'none', color: verdict === v ? VCOLS[v] : MUTED, fontSize: 12, fontWeight: verdict === v ? 700 : 400, cursor: 'pointer' }}>
                  {v}
                </button>
              ))}
            </div>
          </Block>
          <Block n={1} label="Understanding of the Challenge"><TA value={comp.understanding} onChange={v => set('understanding', v)} rows={5} /></Block>
          <Block n={2} label="Approach & Recommended Option"><TA value={comp.approachAndRecommendedOption} onChange={v => set('approachAndRecommendedOption', v)} rows={6} /></Block>
          <Block n={3} label="Delivery Plan">
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase' }}>Narrative</div>
              <TA value={comp.deliveryPlan?.narrative} onChange={v => setDP('narrative', v)} rows={3} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase' }}>Milestones</div>
            <InlineTable columns={MILESTONES_COLS} rows={comp.deliveryPlan?.milestones || []} onChange={v => setDP('milestones', v)} />
          </Block>
          <Block n={4} label="Domain Component">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase' }}>Title</div>
              <input value={comp.domainComponent?.title || ''} onChange={e => setDC('title', e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <TA value={comp.domainComponent?.content} onChange={v => setDC('content', v)} rows={5} />
          </Block>
          <Block n={5} label="Resourcing">
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase' }}>Delivery team</div>
              <InlineTable columns={TEAM_COLS} rows={comp.resourcing?.deliveryTeam || []} onChange={v => setRes('deliveryTeam', v)} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase' }}>Buyer-side commitment required</div>
            <TA value={comp.resourcing?.buyerCommitment} onChange={v => setRes('buyerCommitment', v)} rows={3} />
          </Block>
          <Block n={6} label="Acceptance & Quality Gates"><InlineTable columns={GATES_COLS} rows={comp.acceptanceGates || []} onChange={setF('acceptanceGates')} /></Block>
          <Block n={7} label="Pre-Work Required by Buyer"><StringList items={comp.preWork || []} onChange={setF('preWork')} /></Block>
          <Block n={8} label="Assumptions, Limitations & Dependencies"><StringList items={comp.assumptions || []} onChange={setF('assumptions')} /></Block>
          <Block n={9} label="Configuration / Customisation / Third-Party"><TA value={comp.configCustomisationThirdParty} onChange={v => set('configCustomisationThirdParty', v)} rows={5} /></Block>
          <Block n={10} label="Costs & Fit-Gaps"><TA value={comp.costs} onChange={v => set('costs', v)} rows={4} yellow /></Block>
          <Block n={11} label="Risks & Mitigations"><InlineTable columns={RISKS_COLS} rows={comp.risks || []} onChange={setF('risks')} /></Block>
          {openDeps.length > 0 && <Block label="Open Dependencies / Clarification Questions"><StringList items={openDeps} onChange={setOpenDeps} /></Block>}
        </div>

        {/* Sidebar */}
        <div style={{ width: 286, flexShrink: 0, padding: '20px 16px 20px 0' }}>
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
            {/* Placeholders */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Placeholders</div>
                <div style={{ fontSize: 11, color: unfilledCount > 0 ? AMBER : GREEN, marginTop: 2, fontWeight: 600 }}>{unfilledCount > 0 ? `${unfilledCount} need input` : '✓ All filled'}</div>
              </div>
              <div style={{ padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
                {placeholders.length === 0 ? <div style={{ fontSize: 12, color: GREEN, fontStyle: 'italic' }}>None found</div>
                  : placeholders.map(ph => {
                    const filled = !!phValues[ph.key]?.trim()
                    return (
                      <div key={ph.key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: filled ? GREEN : AMBER, textTransform: 'uppercase', marginBottom: 1 }}>{filled ? '✓' : '○'} {ph.key}</div>
                        <div style={{ fontSize: 9, color: MUTED, marginBottom: 3 }}>in {ph.context}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input value={phValues[ph.key] || ''} onChange={e => setPhValues(p => ({ ...p, [ph.key]: e.target.value }))} placeholder="Enter value…" style={{ flex: 1, padding: '4px 7px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, minWidth: 0 }} />
                          <button onClick={() => applyPh(ph.key, ph.placeholder, phValues[ph.key])} disabled={!phValues[ph.key]?.trim()}
                            style={{ background: phValues[ph.key]?.trim() ? BLUE : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 4, padding: '4px 7px', fontSize: 10, fontWeight: 700, cursor: phValues[ph.key]?.trim() ? 'pointer' : 'not-allowed' }}>Apply</button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Status flow */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px', flexShrink: 0 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                <StatusBadge status={sectionStatus} />
              </div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
                {sectionStatus === 'drafted'   && 'Fill placeholders and review all components. Mark ready when done.'}
                {sectionStatus === 'in_review' && 'Under review. Approve once a human has checked all content and placeholders.'}
                {sectionStatus === 'approved'  && 'Approved and export-ready.'}
                {sectionStatus === 'reopened'  && 'Reopened for further editing.'}
              </div>
              {advErr && <div style={{ marginBottom: 8, fontSize: 11, color: RED, background: '#FEE2E2', padding: '5px 8px', borderRadius: 6 }}>{advErr}</div>}
              {unfilledCount > 0 && sectionStatus === 'in_review' && (
                <div style={{ marginBottom: 8, fontSize: 11, color: AMBER, background: '#FEF9C3', padding: '5px 8px', borderRadius: 6 }}>
                  ⚠ Fill {unfilledCount} placeholder{unfilledCount !== 1 ? 's' : ''} before approving.
                </div>
              )}
              {sectionStatus !== 'approved' && (
                <button onClick={advance} disabled={advancing}
                  style={{ width: '100%', background: advancing ? '#CBD5E1' : (sectionStatus === 'in_review' ? GREEN : BLUE), color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: advancing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  {advancing ? <><Spinner /> Updating…</> : sectionStatus === 'in_review' ? '✓ Approve Response' : 'Mark for Review'}
                </button>
              )}
              {sectionStatus === 'approved' && (
                <>
                  <button onClick={doExport} disabled={exporting}
                    style={{ width: '100%', background: exporting ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                    {exporting ? <><Spinner /> Generating…</> : '⬇ Export to .docx'}
                  </button>
                  <button onClick={reopen} disabled={reopening}
                    style={{ width: '100%', background: 'none', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 6, padding: '7px 0', fontSize: 11, fontWeight: 600, cursor: reopening ? 'not-allowed' : 'pointer' }}>
                    {reopening ? 'Reopening…' : '↩ Reopen for editing'}
                  </button>
                  {exportErr && <div style={{ marginTop: 6, color: RED, fontSize: 11 }}>{exportErr}</div>}
                </>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>History</div>
                <div style={{ padding: '8px 12px', maxHeight: 260, overflowY: 'auto' }}>
                  {history.slice(0, 25).map((ev, i) => {
                    const m = EVENT_META[ev.type] || { icon: '·', label: ev.type }
                    return (
                      <div key={ev.id || i} style={{ display: 'flex', gap: 7, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.3 }}>{m.icon}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{ev.summary}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>{timeAgo(ev.createdAt)} · {ev.actor}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
  const [screen, setScreen]           = useState('setup')
  const [pack, setPack]               = useState(null)
  const [sections, setSections]       = useState([])
  const [currentSection, setCurrent]  = useState(null)
  const [currentIdx, setCurrentIdx]   = useState(0)
  const [recovering, setRecovering]   = useState(false)

  // On mount: if a packId was stored (e.g. after refresh or navigating to RAI Home),
  // re-fetch the pack from the server and restore the dashboard without losing work.
  useEffect(() => {
    const storedId = sessionStorage.getItem(SESSION_KEY)
    if (!storedId) return
    setRecovering(true)
    import('./api.js').then(({ rfpGetPack }) =>
      rfpGetPack(storedId)
        .then(p => { setPack(p); setSections(p.sections || []); setScreen('dashboard') })
        .catch(() => sessionStorage.removeItem(SESSION_KEY))
        .finally(() => setRecovering(false))
    )
  }, [])

  function handlePack(p) {
    sessionStorage.setItem(SESSION_KEY, p.id)
    setPack(p); setSections(p.sections || []); setScreen('dashboard')
  }

  function handleReset() {
    sessionStorage.removeItem(SESSION_KEY)
    setPack(null); setSections([]); setScreen('setup')
  }

  function updateSection(changed) {
    // changed: { sectionId, draft?, sectionStatus? }
    setSections(prev => prev.map(s => s.id === changed.sectionId ? {
      ...s,
      ...(changed.draft ? { draft: changed.draft } : {}),
      ...(changed.sectionStatus ? { status: changed.sectionStatus } : {}),
    } : s))
    setCurrent(prev => prev && prev.id === changed.sectionId ? {
      ...prev,
      ...(changed.draft ? { draft: changed.draft } : {}),
      ...(changed.sectionStatus ? { status: changed.sectionStatus } : {}),
    } : prev)
  }

  function openSection(section) {
    const latestSections = sections.length ? sections : [section]
    const latest  = latestSections.find(s => s.id === section.id) || section
    const idx     = latestSections.findIndex(s => s.id === latest.id)
    setCurrent(latest)
    setCurrentIdx(idx >= 0 ? idx : 0)
    setScreen('draft')
  }

  function handleNavigate(targetSection) {
    const latest = sections.find(s => s.id === targetSection.id) || targetSection
    const idx    = sections.findIndex(s => s.id === latest.id)
    if (latest.draft) {
      setCurrent(latest)
      setCurrentIdx(idx >= 0 ? idx : 0)
      // screen stays 'draft' — key on currentSection.id forces remount
    } else {
      setScreen('dashboard')
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {screen !== 'draft' && (
        <div style={{ background: NAVY, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← RAI Home</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP Response Drafter</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Commercial lens</span>
          {pack && screen === 'dashboard' && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>/ {pack.buyer}</span>}
        </div>
      )}
      {recovering && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10, color: MUTED, fontSize: 13 }}>
          <Spinner /> Restoring your session…
        </div>
      )}
      {!recovering && screen === 'setup' && (
        <SetupScreen onPack={handlePack} />
      )}
      {!recovering && screen === 'dashboard' && pack && (
        <DashboardScreen
          pack={pack}
          sections={sections}
          onSectionsChange={setSections}
          onOpenSection={openSection}
          onReset={handleReset}
        />
      )}
      {screen === 'draft' && currentSection && (
        <DraftScreen
          key={currentSection.id}
          section={currentSection}
          sections={sections}
          currentIdx={currentIdx}
          buyer={pack?.buyer}
          onBack={() => setScreen('dashboard')}
          onNavigate={handleNavigate}
          onSectionChanged={updateSection}
        />
      )}
    </div>
  )
}

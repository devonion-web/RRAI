import React, { useState, useRef, useEffect } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpUploadFiles, rfpStoreText, rfpRemoveDocument,
  rfpCreatePack, rfpDetectSections,
  rfpExtractBrief, rfpGenerateDraft, rfpUpdateDraft, rfpAdvanceDraftStatus,
} from './api.js'

// ── Brand ─────────────────────────────────────────────────────────────────────
const NAVY = '#0B1F3A', BLUE = '#1D4ED8', GREEN = '#16A34A'
const AMBER = '#D97706', RED = '#DC2626', PURPLE = '#7C3AED', MUTED = '#64748B'
const BORDER = '#E2E8F0', WHITE = '#FFFFFF', BG = '#F8FAFC'
const DOC_NAVY = '06095A', DOC_PURPLE = '3205B3', DOC_CYAN = '13D4DB'
const DOC_LCYAN = 'E7FAFB', DOC_GRAY = '64748B'

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
}
function Badge({ label, color }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: color.bg, color: color.text }}>{label}</span>
}
function StatusBadge({ status }) {
  const m = { draft: { label: 'DRAFT', bg: '#FEF9C3', text: AMBER }, in_review: { label: 'IN REVIEW', bg: '#DBEAFE', text: BLUE }, approved: { label: 'APPROVED', bg: '#D1FAE5', text: GREEN } }
  const c = m[status] || m.draft
  return <Badge label={c.label} color={c} />
}
function VerdictBadge({ verdict }) {
  const m = { 'Complies': { bg: '#D1FAE5', text: GREEN }, 'Partially Complies': { bg: '#FEF9C3', text: AMBER }, 'Does Not Comply': { bg: '#FEE2E2', text: RED } }
  return <Badge label={verdict || 'Not set'} color={m[verdict] || { bg: '#F1F5F9', text: MUTED }} />
}
function SectionNum({ n }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n}</span>
}

// ── Placeholder utilities ─────────────────────────────────────────────────────
function scanForPlaceholders(value, ctx = '') {
  const out = []
  if (typeof value === 'string') {
    for (const m of [...value.matchAll(/\{\{PLACEHOLDER:\s*([^}]+?)\}\}/g)]) {
      out.push({ key: m[1].trim(), placeholder: m[0], context: ctx })
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...scanForPlaceholders(v, ctx || `item ${i + 1}`)))
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) out.push(...scanForPlaceholders(v, k))
  }
  return out
}
function detectPlaceholders(components) {
  const seen = new Set()
  return scanForPlaceholders(components).filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true })
}
function applyToAll(value, ph, rep) {
  if (typeof value === 'string') return value.split(ph).join(rep)
  if (Array.isArray(value)) return value.map(v => applyToAll(v, ph, rep))
  if (value && typeof value === 'object') { const r = {}; for (const [k, v] of Object.entries(value)) r[k] = applyToAll(v, ph, rep); return r }
  return value
}

// ── Draft generic editors ─────────────────────────────────────────────────────
function BlockHeader({ n, label, extra }) {
  return (
    <div style={{ background: NAVY, color: WHITE, padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
      {n && <SectionNum n={n} />}{label}{extra}
    </div>
  )
}
function Block({ n, label, extra, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <BlockHeader n={n} label={label} extra={extra} />
      <div style={{ border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: WHITE, padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}
function TA({ value, onChange, rows = 4, yellow = false }) {
  const hasPlaceholder = typeof value === 'string' && value.includes('{{PLACEHOLDER:')
  return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows}
      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', color: '#1E293B', background: (yellow || hasPlaceholder) ? '#FFFBEB' : '#FAFBFC' }}
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
  function updateCell(ri, key, val) { const n = rows.map((r, i) => i === ri ? { ...r, [key]: val } : r); onChange(n) }
  function addRow() { const e = {}; columns.forEach(c => e[c.key] = ''); onChange([...(rows || []), e]) }
  function removeRow(i) { onChange(rows.filter((_, j) => j !== i)) }
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>{columns.map(c => <th key={c.key} style={{ background: NAVY, color: WHITE, padding: '5px 8px', fontSize: 10, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', width: c.w }}>{c.label}</th>)}<th style={{ background: NAVY, width: 30 }} /></tr>
          </thead>
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
                  <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14 }}>×</button>
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
function dBullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: String(text || '').trim(), font: 'Arial', size: 22, color: '1F2937' })] })
}
function dH(label) {
  return new Paragraph({ spacing: { before: 240, after: 100 }, shading: { type: ShadingType.CLEAR, fill: DOC_NAVY }, children: [new TextRun({ text: `  ${label}`, font: 'Arial', size: 24, bold: true, color: 'FFFFFF' })] })
}
function dCallout(text) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({
    shading: { type: ShadingType.CLEAR, fill: DOC_LCYAN },
    margins: { top: 120, bottom: 120, left: 180, right: 180 },
    borders: { left: { style: BorderStyle.THICK, size: 12, color: DOC_CYAN }, top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } },
    children: [new Paragraph({ children: [new TextRun({ text: String(text || '').trim(), font: 'Arial', size: 20, color: DOC_NAVY, italics: true })] })]
  })] })] })
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
  const children = []

  // Cover
  children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'RFP Response — Commercial Lens', font: 'Arial', size: 44, bold: true, color: DOC_NAVY })] }))
  children.push(dPara(buyer, { size: 32, bold: true, color: DOC_NAVY, after: 80 }))
  children.push(dPara(`Section ${sectionCode}: ${sectionTitle}`, { size: 26, color: DOC_PURPLE, after: 60 }))
  children.push(dPara(`Prepared by Risk Rising · ${today}`, { size: 20, color: DOC_GRAY, after: 120 }))
  children.push(dCallout('DRAFT — FOR INTERNAL REVIEW ONLY. Not approved for release. Commercial lens: do not present as independent analyst content.'))
  children.push(dSpace())

  // Compliance verdict
  children.push(dH('Compliance Verdict'))
  children.push(dPara(complianceVerdict || 'Not assessed', { bold: true, color: DOC_NAVY }))
  children.push(dSpace())

  // Understanding
  children.push(dH('1. Understanding of the Challenge'))
  ;(c.understanding || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  children.push(dSpace())

  // Approach
  children.push(dH('2. Approach & Recommended Option'))
  ;(c.approachAndRecommendedOption || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  children.push(dSpace())

  // Delivery plan
  children.push(dH('3. Delivery Plan'))
  ;(c.deliveryPlan?.narrative || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  if (c.deliveryPlan?.milestones?.length) {
    children.push(dSpace())
    children.push(dTable(['Phase', 'Timing', 'Activities', 'Exit Criteria'], c.deliveryPlan.milestones.map(m => [m.phase, m.timing, m.activities, m.exit])))
  }
  children.push(dSpace())

  // Domain component
  children.push(dH(`4. Domain Component — ${c.domainComponent?.title || ''}`))
  ;(c.domainComponent?.content || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  children.push(dSpace())

  // Resourcing
  children.push(dH('5. Resourcing'))
  if (c.resourcing?.deliveryTeam?.length) {
    children.push(dTable(['Role', 'Responsibility', 'Phases'], c.resourcing.deliveryTeam.map(m => [m.role, m.responsibility, m.phases])))
    children.push(dSpace())
  }
  if (c.resourcing?.buyerCommitment) {
    children.push(dPara('Buyer-side commitment required:', { bold: true, color: DOC_NAVY }))
    children.push(dCallout(c.resourcing.buyerCommitment))
  }
  children.push(dSpace())

  // Acceptance gates
  children.push(dH('6. Acceptance & Quality Gates'))
  if (c.acceptanceGates?.length) {
    children.push(dTable(['Gate', 'Entry Criteria', 'Exit Criteria'], c.acceptanceGates.map(g => [g.gate, g.entry, g.exit])))
  } else { children.push(dPara('No acceptance gates defined.', { color: DOC_GRAY })) }
  children.push(dSpace())

  // Pre-work
  children.push(dH('7. Pre-Work Required by Buyer'))
  if (c.preWork?.length) { c.preWork.forEach(p => children.push(dBullet(p))) }
  else { children.push(dPara('None identified.', { color: DOC_GRAY })) }
  children.push(dSpace())

  // Assumptions
  children.push(dH('8. Assumptions, Limitations & Dependencies'))
  if (c.assumptions?.length) {
    const asText = c.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n')
    children.push(dCallout(asText))
  }
  children.push(dSpace())

  // Config
  children.push(dH('9. Configuration / Customisation / Third-Party'))
  ;(c.configCustomisationThirdParty || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  children.push(dSpace())

  // Costs
  children.push(dH('10. Costs & Fit-Gaps'))
  ;(c.costs || '').split(/\n+/).filter(Boolean).forEach(p => children.push(dPara(p)))
  children.push(dSpace())

  // Risks
  children.push(dH('11. Risks & Mitigations'))
  if (c.risks?.length) {
    children.push(dTable(['Risk', 'L×I', 'Mitigation', 'Owner'], c.risks.map(r => [r.risk, r.likelihoodImpact, r.mitigation, r.owner])))
  } else { children.push(dPara('No risks identified.', { color: DOC_GRAY })) }

  // Open dependencies
  if (openDependencies?.length) {
    children.push(dSpace())
    children.push(dH('Open Dependencies / Clarification Questions'))
    openDependencies.forEach(d => children.push(dBullet(d)))
  }

  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Commercial lens — Risk Rising internal draft   ', font: 'Arial', size: 18, color: DOC_GRAY }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: DOC_GRAY })] })] })
  const doc = new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, footers: { default: footer }, children }] })

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

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>New Bid Pack</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Upload the buyer's procurement files. RRAI will detect scored sections and guide you through each draft.</div>
      </div>

      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '18px 22px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[['Buyer / Organisation', buyer, setBuyer, 'e.g. Marks & Spencer'], ['Pack Name', packName, setPackName, 'e.g. M&S GRC RFP 2026']].map(([label, val, set, ph]) => (
            <div key={label}>
              <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paste document text</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <input value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder="Document name" style={{ ...inputStyle, width: 'auto', flex: 1 }} />
            <button onClick={addPaste} disabled={!pasteText.trim() || uploading}
              style={{ background: pasteText.trim() && !uploading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() && !uploading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
          <textarea value={pasteText} onChange={e => setPaste(e.target.value)} rows={3} placeholder="Paste RFP content, evaluation framework, scope, or procurement instructions…"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        <div onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)) }} onDragOver={e => e.preventDefault()}
          style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10, marginBottom: documents.length ? 10 : 0 }}>
          <span>{uploading ? '⏳' : '📎'}</span>
          <span style={{ fontSize: 12, color: MUTED }}>{uploading ? 'Uploading…' : 'Drop files — PDF, Word, Excel, text'}</span>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Browse</button>
          <input ref={fileRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md" style={{ display: 'none' }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
        </div>

        {documents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {documents.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EAF1F8', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                <span>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                <span>{d.name}</span>
                <button onClick={() => { rfpRemoveDocument(d.id); setDocs(p => p.filter(x => x.id !== d.id)) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, padding: 0 }}>×</button>
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

// ── Sections screen ───────────────────────────────────────────────────────────
function SectionsScreen({ pack, onDraft, onReset }) {
  const [sections, setSections]   = useState(pack.sections || [])
  const [detecting, setDetecting] = useState(false)
  const [briefLoading, setBriefLoading] = useState(null)
  const [draftLoading, setDraftLoading] = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [error, setError]         = useState(null)

  useEffect(() => { if (!sections.length) detect() }, [])

  async function detect() {
    setDetecting(true); setError(null)
    try { const { sections: s } = await rfpDetectSections(pack.id); setSections(s || []) }
    catch (e) { setError(e.message) }
    finally { setDetecting(false) }
  }

  async function extractBrief(section) {
    setBriefLoading(section.id); setError(null)
    try {
      const { section: updated } = await rfpExtractBrief(section.id)
      setSections(p => p.map(s => s.id === section.id ? updated : s))
      setExpanded(section.id)
    } catch (e) { setError(e.message) }
    finally { setBriefLoading(null) }
  }

  async function startDraft(section) {
    setDraftLoading(section.id); setError(null)
    try { const { draft } = await rfpGenerateDraft(section.id); onDraft({ ...section, draft }) }
    catch (e) { setError(e.message); setDraftLoading(null) }
  }

  function BriefPanel({ s }) {
    const P = ({ label, children, color = MUTED }) => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        {children}
      </div>
    )
    return (
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', background: '#FAFBFC' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {s.requirements?.length > 0 && (
            <P label={`Requirements (${s.requirements.length})`} color={NAVY}>
              {s.requirements.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>
                  <span style={{ color: BLUE, flexShrink: 0 }}>{r.id || i + 1}.</span>
                  <span>{r.text}</span>
                  {r.priority && <Badge label={r.priority} color={{ bg: '#FEF9C3', text: AMBER }} />}
                </div>
              ))}
            </P>
          )}
          {s.minimumResponseItems?.length > 0 && (
            <P label="Minimum response items" color={NAVY}>
              {s.minimumResponseItems.map((m, i) => <div key={i} style={{ fontSize: 12, color: '#1E293B', marginBottom: 3 }}>✓ {m}</div>)}
            </P>
          )}
          {s.buyerChallenges?.length > 0 && (
            <P label="Buyer challenges" color={RED}>
              {s.buyerChallenges.map((c, i) => <div key={i} style={{ fontSize: 12, color: '#1E293B', marginBottom: 3 }}>⚡ {c}</div>)}
            </P>
          )}
          {s.keyDates?.length > 0 && (
            <P label="Key dates" color={AMBER}>
              <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                {s.keyDates.map((d, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? WHITE : '#F8FAFC' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{d.date}</td>
                    <td style={{ padding: '3px 8px', color: '#1E293B' }}>{d.event}</td>
                  </tr>
                ))}
              </table>
            </P>
          )}
          {s.constraints?.length > 0 && (
            <P label="Constraints" color={RED}>
              {s.constraints.map((c, i) => <div key={i} style={{ fontSize: 12, color: '#1E293B', marginBottom: 3 }}>⚠ {c}</div>)}
            </P>
          )}
          {s.gaps?.length > 0 && (
            <P label="Clarification questions (gaps)" color={PURPLE}>
              {s.gaps.map((g, i) => <div key={i} style={{ fontSize: 12, color: PURPLE, marginBottom: 3 }}>? {g}</div>)}
            </P>
          )}
          {s.discrepancies?.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <P label="⚠ Discrepancies across documents" color={RED}>
                {s.discrepancies.map((d, i) => <div key={i} style={{ fontSize: 12, color: RED, marginBottom: 3 }}>• {d}</div>)}
              </P>
            </div>
          )}
        </div>
        <button onClick={() => startDraft(s)} disabled={!!draftLoading}
          style={{ marginTop: 6, background: draftLoading === s.id ? '#CBD5E1' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: draftLoading ? 'not-allowed' : 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
          {draftLoading === s.id ? <><Spinner /> Drafting…</> : '✦ Generate Draft →'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{pack.buyer}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{pack.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={detect} disabled={detecting} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>↺ Re-detect</button>
          <button onClick={onReset} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>+ New pack</button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
      {detecting && <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>🔍 Detecting scored response sections…</div>}
      {!detecting && sections.length === 0 && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>No scored sections detected.</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Try pasting the RFP's scored question section directly, then re-detect.</div>
          <button onClick={detect} style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↺ Try again</button>
        </div>
      )}
      {sections.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{sections.length} section{sections.length !== 1 ? 's' : ''} detected — extract a brief for each, then generate the draft.</div>
          {sections.map(s => {
            const isExp = expanded === s.id
            const hasB = s.briefStatus === 'extracted'
            const isBL = briefLoading === s.id
            const isDL = draftLoading === s.id
            return (
              <div key={s.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{s.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, flex: 1 }}>{s.title}</span>
                  {s.scoringWeight && <Badge label={s.scoringWeight} color={{ bg: '#FEF9C3', text: AMBER }} />}
                  {s.draft && <Badge label="Drafted" color={{ bg: '#D1FAE5', text: GREEN }} />}
                  {hasB && !s.draft && <Badge label="Brief ready" color={{ bg: '#DBEAFE', text: BLUE }} />}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {!hasB && !isBL && <button onClick={() => extractBrief(s)} style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Extract brief</button>}
                    {isBL && <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Spinner /> Extracting…</button>}
                    {hasB && !isDL && <>
                      <button onClick={() => setExpanded(isExp ? null : s.id)} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: MUTED, cursor: 'pointer' }}>{isExp ? 'Hide' : 'View brief'}</button>
                      <button onClick={() => startDraft(s)} style={{ background: GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.draft ? 'Open draft →' : 'Draft →'}</button>
                    </>}
                    {isDL && <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Spinner /> Drafting…</button>}
                  </div>
                </div>
                {!isExp && s.summary && <div style={{ padding: '0 16px 10px', fontSize: 12, color: MUTED }}>{s.summary}</div>}
                {isExp && hasB && <BriefPanel s={s} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Draft screen ──────────────────────────────────────────────────────────────
function DraftScreen({ section, buyer, onBack }) {
  const d = section.draft
  const [comp, setComp]         = useState(d?.components || {})
  const [verdict, setVerdict]   = useState(d?.complianceVerdict || 'Partially Complies')
  const [openDeps, setOpenDeps] = useState(d?.openDependencies || [])
  const [status, setStatus]     = useState(d?.status || 'draft')
  const [phValues, setPhValues] = useState({})
  const [dirty, setDirty]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [advancing, setAdv]     = useState(false)
  const [exporting, setExp]     = useState(false)
  const [exportErr, setExpErr]  = useState(null)

  const placeholders = detectPlaceholders(comp)
  const unfilledCount = placeholders.filter(p => !phValues[p.key]?.trim()).length

  function set(field, value) { setComp(p => ({ ...p, [field]: value })); setDirty(true) }
  function setDP(field, value) { setComp(p => ({ ...p, deliveryPlan: { ...p.deliveryPlan, [field]: value } })); setDirty(true) }
  function setDC(field, value) { setComp(p => ({ ...p, domainComponent: { ...p.domainComponent, [field]: value } })); setDirty(true) }
  function setRes(field, value) { setComp(p => ({ ...p, resourcing: { ...p.resourcing, [field]: value } })); setDirty(true) }
  function setDirtyField(field) { return v => set(field, v) }

  function applyPh(key, placeholder, value) {
    if (!value?.trim()) return
    setComp(prev => applyToAll(prev, placeholder, value))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try { await rfpUpdateDraft(section.id, { components: comp, complianceVerdict: verdict, openDependencies: openDeps }); setDirty(false) }
    catch {}
    setSaving(false)
  }

  async function advance() {
    if (dirty) await save()
    setAdv(true)
    try { const { draft } = await rfpAdvanceDraftStatus(section.id); setStatus(draft.status) }
    catch {}
    setAdv(false)
  }

  async function doExport() {
    if (dirty) await save()
    setExp(true); setExpErr(null)
    try { await exportSectionDocx({ buyer, sectionCode: section.code, sectionTitle: section.title, draft: { components: comp, complianceVerdict: verdict, openDependencies: openDeps } }) }
    catch (e) { setExpErr(e.message) }
    finally { setExp(false) }
  }

  const MILESTONES_COLS = [{ key: 'phase', label: 'Phase', w: '15%', rows: 2 }, { key: 'timing', label: 'Timing', w: '15%', rows: 2 }, { key: 'activities', label: 'Activities', w: '45%', rows: 3 }, { key: 'exit', label: 'Exit criteria', w: '25%', rows: 3 }]
  const TEAM_COLS   = [{ key: 'role', label: 'Role', w: '20%', rows: 2 }, { key: 'responsibility', label: 'Responsibility', w: '55%', rows: 3 }, { key: 'phases', label: 'Phases', w: '25%', rows: 2 }]
  const GATES_COLS  = [{ key: 'gate', label: 'Gate', w: '20%', rows: 2 }, { key: 'entry', label: 'Entry criteria', w: '40%', rows: 3 }, { key: 'exit', label: 'Exit criteria', w: '40%', rows: 3 }]
  const RISKS_COLS  = [{ key: 'risk', label: 'Risk', w: '30%', rows: 3 }, { key: 'likelihoodImpact', label: 'L×I', w: '10%', rows: 2 }, { key: 'mitigation', label: 'Mitigation', w: '40%', rows: 3 }, { key: 'owner', label: 'Owner', w: '20%', rows: 2 }]
  const VERDICTS = ['Complies', 'Partially Complies', 'Does Not Comply']
  const VERDICT_COLORS = { 'Complies': GREEN, 'Partially Complies': AMBER, 'Does Not Comply': RED }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← Sections</button>
        <VerdictBadge verdict={verdict} />
        <span style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>{section.code} — {section.title}</span>
        {section.scoringWeight && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{section.scoringWeight}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={status} />
          {dirty && <button onClick={save} disabled={saving} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>}
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
                  style={{ flex: 1, padding: '8px 0', border: `2px solid ${verdict === v ? VERDICT_COLORS[v] : BORDER}`, borderRadius: 6, background: verdict === v ? VERDICT_COLORS[v] + '18' : 'none', color: verdict === v ? VERDICT_COLORS[v] : MUTED, fontSize: 12, fontWeight: verdict === v ? 700 : 400, cursor: 'pointer' }}>
                  {v}
                </button>
              ))}
            </div>
          </Block>

          <Block n={1} label="Understanding of the Challenge">
            <TA value={comp.understanding} onChange={v => set('understanding', v)} rows={5} />
          </Block>

          <Block n={2} label="Approach & Recommended Option">
            <TA value={comp.approachAndRecommendedOption} onChange={v => set('approachAndRecommendedOption', v)} rows={6} />
          </Block>

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
              <input value={comp.domainComponent?.title || ''} onChange={e => setDC('title', e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
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

          <Block n={6} label="Acceptance & Quality Gates">
            <InlineTable columns={GATES_COLS} rows={comp.acceptanceGates || []} onChange={setDirtyField('acceptanceGates')} />
          </Block>

          <Block n={7} label="Pre-Work Required by Buyer">
            <StringList items={comp.preWork || []} onChange={setDirtyField('preWork')} />
          </Block>

          <Block n={8} label="Assumptions, Limitations & Dependencies">
            <StringList items={comp.assumptions || []} onChange={setDirtyField('assumptions')} />
          </Block>

          <Block n={9} label="Configuration / Customisation / Third-Party">
            <TA value={comp.configCustomisationThirdParty} onChange={v => set('configCustomisationThirdParty', v)} rows={5} />
          </Block>

          <Block n={10} label="Costs & Fit-Gaps">
            <TA value={comp.costs} onChange={v => set('costs', v)} rows={4} yellow />
          </Block>

          <Block n={11} label="Risks & Mitigations">
            <InlineTable columns={RISKS_COLS} rows={comp.risks || []} onChange={setDirtyField('risks')} />
          </Block>

          {openDeps.length > 0 && (
            <Block label="Open Dependencies / Clarification Questions">
              <StringList items={openDeps} onChange={setOpenDeps} />
            </Block>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: 296, flexShrink: 0, padding: '20px 20px 20px 0' }}>
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Placeholders */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Placeholders</div>
                <div style={{ fontSize: 11, color: unfilledCount > 0 ? AMBER : GREEN, marginTop: 2, fontWeight: 600 }}>
                  {unfilledCount > 0 ? `${unfilledCount} need input` : '✓ All filled'}
                </div>
              </div>
              <div style={{ padding: '10px 14px', maxHeight: 380, overflowY: 'auto' }}>
                {placeholders.length === 0 ? <div style={{ fontSize: 12, color: GREEN, fontStyle: 'italic' }}>None found</div> : placeholders.map(ph => {
                  const filled = !!phValues[ph.key]?.trim()
                  return (
                    <div key={ph.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: filled ? GREEN : AMBER, textTransform: 'uppercase', marginBottom: 2 }}>{filled ? '✓' : '○'} {ph.key}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>in {ph.context}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input value={phValues[ph.key] || ''} onChange={e => setPhValues(p => ({ ...p, [ph.key]: e.target.value }))} placeholder="Enter value…"
                          style={{ flex: 1, padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, minWidth: 0 }} />
                        <button onClick={() => applyPh(ph.key, ph.placeholder, phValues[ph.key])} disabled={!phValues[ph.key]?.trim()}
                          style={{ background: phValues[ph.key]?.trim() ? BLUE : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 4, padding: '5px 8px', fontSize: 10, fontWeight: 700, cursor: phValues[ph.key]?.trim() ? 'pointer' : 'not-allowed' }}>
                          Apply
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status flow */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '13px 14px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                <StatusBadge status={status} />
              </div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginBottom: 10 }}>
                {status === 'draft' && 'Fill placeholders and edit components. Mark ready when done.'}
                {status === 'in_review' && 'Under review. Approve once a human has checked all content.'}
                {status === 'approved' && 'Approved. Safe to export.'}
              </div>
              {status !== 'approved' && (
                <button onClick={advance} disabled={advancing}
                  style={{ width: '100%', background: advancing ? '#CBD5E1' : (status === 'in_review' ? GREEN : BLUE), color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: advancing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  {advancing ? <><Spinner /> Updating…</> : status === 'in_review' ? 'Approve Response' : 'Mark Ready for Review'}
                </button>
              )}
              {status === 'approved' && (
                <>
                  <button onClick={doExport} disabled={exporting}
                    style={{ width: '100%', background: exporting ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {exporting ? <><Spinner /> Generating…</> : '⬇ Export to .docx'}
                  </button>
                  {exportErr && <div style={{ marginTop: 6, color: RED, fontSize: 11 }}>{exportErr}</div>}
                </>
              )}
              {status !== 'approved' && unfilledCount > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: AMBER, background: '#FEF9C3', padding: '5px 8px', borderRadius: 6 }}>
                  {unfilledCount} placeholder{unfilledCount !== 1 ? 's' : ''} still unfilled.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function RFPModule({ onBack }) {
  const [screen, setScreen] = useState('setup')
  const [pack, setPack]     = useState(null)
  const [section, setSection] = useState(null)

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {screen !== 'draft' && (
        <div style={{ background: NAVY, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>← RAI Home</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP Response Drafter</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Commercial lens</span>
          {pack && screen === 'sections' && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>/ {pack.buyer}</span>}
        </div>
      )}
      {screen === 'setup' && <SetupScreen onPack={p => { setPack(p); setScreen('sections') }} />}
      {screen === 'sections' && pack && <SectionsScreen pack={pack} onDraft={s => { setSection(s); setScreen('draft') }} onReset={() => { setPack(null); setScreen('setup') }} />}
      {screen === 'draft' && section && <DraftScreen section={section} buyer={pack?.buyer} onBack={() => { setSection(null); setScreen('sections') }} />}
    </div>
  )
}

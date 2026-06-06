import React, { useState, useRef } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ShadingType,
  Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpExtractRequirements,
  rfpClassify,
  rfpGenerateResponses,
  rfpGenerateVendorPack,
  rfpGenerateGapAnalysis,
} from './api.js'

// ── Colours ──────────────────────────────────────────────────────────────────
const NAVY = '#0B1F3A'
const BLUE_LIGHT = '#EAF1F8'
const TEXT = '#1E293B'
const MUTED = '#64748B'
const BORDER = '#E2E8F0'
const GREEN = '#16A34A'
const AMBER = '#D97706'
const RED = '#DC2626'
const WHITE = '#FFFFFF'

// ── Owner badge colours ───────────────────────────────────────────────────────
function ownerColour(owner) {
  switch (owner) {
    case 'RR': return { bg: '#DBEAFE', text: '#1D4ED8' }
    case 'LogicGate': return { bg: '#F3E8FF', text: '#7C3AED' }
    case 'Panorays': return { bg: '#FCE7F3', text: '#BE185D' }
    case 'Joint': return { bg: '#D1FAE5', text: '#065F46' }
    default: return { bg: '#F1F5F9', text: '#64748B' }
  }
}

function severityColour(s) {
  if (s === 'High') return RED
  if (s === 'Medium') return AMBER
  return GREEN
}

// ── DOCX helpers ──────────────────────────────────────────────────────────────
function clean(t) { return t ? String(t).replace(/\n/g, ' ').trim() : '' }

function docHeaderBar(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 300, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A', color: 'auto' },
    children: [
      new TextRun({ text: '  ' }),
      new TextRun({ text: clean(text), bold: true, color: 'FFFFFF', font: 'Calibri', size: 24 }),
    ],
  })
}

function docSubBar(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: 'EAF1F8', color: 'auto' },
    children: [
      new TextRun({ text: '  ' }),
      new TextRun({ text: clean(text), bold: true, color: '0B1F3A', font: 'Calibri', size: 22 }),
    ],
  })
}

function docBody(text) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    indent: { left: 120 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}

function docLabel(label, value) {
  if (!value) return null
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    indent: { left: 120 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
      new TextRun({ text: clean(value), font: 'Calibri', size: 22, color: '1E293B' }),
    ],
  })
}

function docBullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 260 },
    indent: { left: 360, hanging: 240 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}

function docSpacer() {
  return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 60, after: 60 } })
}

function docDivider() {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text: '', font: 'Calibri', size: 4 })],
    border: { bottom: { style: 'single', size: 4, color: 'E2E8F0', space: 1 } },
  })
}

function tableCell(text, { bold = false, bg = 'FFFFFF', shade = false } = {}) {
  return new TableCell({
    shading: shade ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold, color: '1E293B' })],
    })],
  })
}

// ── DOCX export ───────────────────────────────────────────────────────────────
async function exportDocx({ health, merged, vendorPack, gapAnalysis, company }) {
  const children = []

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
    children: [new TextRun({ text: `RFP/RFI Response Pack`, font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 300 },
    children: [new TextRun({ text: `${company || 'Unknown'} · Prepared by Risk Rising`, font: 'Calibri', size: 24, color: '64748B' })],
  }))

  // Health check
  if (health) {
    children.push(docHeaderBar('Opportunity Health Check'))
    const healthRows = [
      ['RFP Type', health.rfp_type],
      ['Response Deadline', health.response_deadline || 'Not specified'],
      ['Total Requirements', String(health.total_requirements ?? '—')],
      ['LogicGate Fit', health.logicgate_fit],
      ['Panorays Fit', health.panorays_fit],
      ['RR Delivery Fit', health.rr_delivery_fit],
      ['Managed Service Potential', health.managed_service_potential],
      ['Commercial Complexity', health.commercial_complexity],
      ['Recommended Action', health.recommended_action],
    ].filter(([, v]) => v)
    healthRows.forEach(([k, v]) => { const p = docLabel(k, v); if (p) children.push(p) })
    if (health.recommended_action_rationale) {
      children.push(docSpacer())
      children.push(docBody(health.recommended_action_rationale))
    }
    if (Array.isArray(health.key_risks) && health.key_risks.length) {
      children.push(docSubBar('Key Risks'))
      health.key_risks.forEach((r) => children.push(docBullet(r)))
    }
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Requirements + responses table
  if (Array.isArray(merged) && merged.length) {
    children.push(docHeaderBar('Requirements & Responses'))
    children.push(docSpacer())

    // Header row
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        tableCell('ID', { bold: true, bg: '0B1F3A', shade: true }),
        tableCell('Question', { bold: true, bg: '0B1F3A', shade: true }),
        tableCell('Category', { bold: true, bg: '0B1F3A', shade: true }),
        tableCell('Owner', { bold: true, bg: '0B1F3A', shade: true }),
        tableCell('RR Draft Response', { bold: true, bg: '0B1F3A', shade: true }),
        tableCell('Vendor Prompt', { bold: true, bg: '0B1F3A', shade: true }),
      ],
    })

    const dataRows = merged.map((req) => new TableRow({
      children: [
        tableCell(req.requirement_id),
        tableCell(req.original_question),
        tableCell(req.category),
        tableCell(req.owner || '—'),
        tableCell(req.rr_response_draft || '—'),
        tableCell(req.vendor_prompt || '—'),
      ],
    }))

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      },
      rows: [headerRow, ...dataRows],
    }))
    children.push(docSpacer())
  }

  // Vendor packs
  if (vendorPack) {
    if (vendorPack.logicgate_pack) {
      children.push(docHeaderBar('LogicGate Input Request'))
      children.push(docSpacer())
      vendorPack.logicgate_pack.split('\n').filter(Boolean).forEach((line) => {
        if (line.startsWith('#')) children.push(docSubBar(line.replace(/^#+\s*/, '')))
        else if (line.startsWith('- ') || line.startsWith('* ')) children.push(docBullet(line.slice(2)))
        else children.push(docBody(line))
      })
      children.push(docDivider())
      children.push(docSpacer())
    }
    if (vendorPack.panorays_pack) {
      children.push(docHeaderBar('Panorays Input Request'))
      children.push(docSpacer())
      vendorPack.panorays_pack.split('\n').filter(Boolean).forEach((line) => {
        if (line.startsWith('#')) children.push(docSubBar(line.replace(/^#+\s*/, '')))
        else if (line.startsWith('- ') || line.startsWith('* ')) children.push(docBullet(line.slice(2)))
        else children.push(docBody(line))
      })
      children.push(docDivider())
      children.push(docSpacer())
    }
  }

  // Gap analysis
  if (gapAnalysis) {
    children.push(docHeaderBar('Gap & Risk Analysis'))
    if (gapAnalysis.summary) { children.push(docSpacer()); children.push(docBody(gapAnalysis.summary)) }
    if (Array.isArray(gapAnalysis.gaps) && gapAnalysis.gaps.length) {
      children.push(docSubBar('Gaps'))
      gapAnalysis.gaps.forEach((g) => children.push(docBullet(`[${g.severity}] ${g.description} — ${g.mitigation}`)))
    }
    if (Array.isArray(gapAnalysis.risks) && gapAnalysis.risks.length) {
      children.push(docSubBar('Risks'))
      gapAnalysis.risks.forEach((r) => children.push(docBullet(`[${r.severity}] ${r.description} (${r.owner})`)))
    }
    if (Array.isArray(gapAnalysis.customer_questions) && gapAnalysis.customer_questions.length) {
      children.push(docSubBar('Questions for Customer'))
      gapAnalysis.customer_questions.forEach((q) => children.push(docBullet(q)))
    }
    if (Array.isArray(gapAnalysis.vendor_questions) && gapAnalysis.vendor_questions.length) {
      children.push(docSubBar('Questions for Vendor'))
      gapAnalysis.vendor_questions.forEach((q) => children.push(docBullet(q)))
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RFP-Response-Pack-${(company || 'Unknown').replace(/\s+/g, '-')}.docx`)
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Badge({ label, colour }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11,
      fontWeight: 600, background: colour.bg, color: colour.text, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function SeverityDot({ s }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: severityColour(s), marginRight: 6 }} />
}

function Card({ children, style }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '20px 24px', ...style }}>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
      <div style={{
        width: 16, height: 16, border: `2px solid ${BORDER}`, borderTopColor: NAVY,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      Analysing…
    </div>
  )
}

function HealthPill({ label, value }) {
  const colour = value === 'High' ? { bg: '#DCFCE7', text: GREEN }
    : value === 'Medium' ? { bg: '#FEF9C3', text: AMBER }
    : value === 'Low' ? { bg: '#FEE2E2', text: RED }
    : { bg: '#F1F5F9', text: MUTED }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: TEXT }}>{label}</span>
      <Badge label={value || '—'} colour={colour} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RFPModule() {
  // Inputs
  const [company, setCompany] = useState('')
  const [vendorContext, setVendorContext] = useState('LogicGate')
  const [documents, setDocuments] = useState([]) // [{name, text}]
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('RFP Document')
  const fileInputRef = useRef(null)

  // Stage data
  const [health, setHealth] = useState(null)
  const [requirements, setRequirements] = useState([]) // raw extracted
  const [classified, setClassified] = useState([])     // with owner/priority
  const [responses, setResponses] = useState([])       // with drafts
  const [vendorPack, setVendorPack] = useState(null)
  const [gapAnalysis, setGapAnalysis] = useState(null)

  // UI state
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('matrix')
  const [expandedRow, setExpandedRow] = useState(null)
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')

  // Merge classified + responses
  const merged = classified.map((c) => {
    const base = requirements.find((r) => r.requirement_id === c.requirement_id) || {}
    const resp = responses.find((r) => r.requirement_id === c.requirement_id) || {}
    return { ...base, ...c, ...resp }
  })

  // ── Add pasted text as a document ───────────────────────────────────────────
  function addPastedDoc() {
    if (!pasteText.trim()) return
    setDocuments((prev) => [...prev, { name: pasteName || 'RFP Document', text: pasteText.trim() }])
    setPasteText('')
    setPasteName('RFP Document')
  }

  // ── File upload — server-side parsing for Word/PDF/Excel ────────────────────
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files) {
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      for (const file of files) formData.append('files', file)
      const res = await fetch('/api/rfp/upload-files', { method: 'POST', body: formData })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Upload failed: ${res.status}`)
      }
      const { files: parsed } = await res.json()
      const good = parsed.filter((f) => f.text && !f.error)
      const bad = parsed.filter((f) => f.error || !f.text)
      if (good.length) setDocuments((prev) => [...prev, ...good.map((f) => ({ name: f.name, text: f.text }))])
      if (bad.length) setError(`Could not extract text from: ${bad.map((f) => f.name).join(', ')}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length) handleFiles(Array.from(files))
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
  }

  // ── Step 1: Extract ─────────────────────────────────────────────────────────
  async function runExtract() {
    if (!documents.length) return
    setLoading('extract')
    setError(null)
    try {
      const result = await rfpExtractRequirements({ documents, vendorContext, company })
      setHealth(result.health || null)
      setRequirements(result.requirements || [])
      setClassified([])
      setResponses([])
      setVendorPack(null)
      setGapAnalysis(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  // ── Step 2: Classify ────────────────────────────────────────────────────────
  async function runClassify() {
    setLoading('classify')
    setError(null)
    try {
      const result = await rfpClassify({ requirements, vendorContext, company })
      setClassified(result.requirements || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  // ── Step 3: Generate responses ──────────────────────────────────────────────
  async function runResponses() {
    setLoading('respond')
    setError(null)
    try {
      const payload = classified.length ? classified.map((c) => {
        const base = requirements.find((r) => r.requirement_id === c.requirement_id) || {}
        return { ...base, ...c }
      }) : requirements
      const result = await rfpGenerateResponses({ requirements: payload, vendorContext, company })
      setResponses(result.responses || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  // ── Step 4: Vendor pack ─────────────────────────────────────────────────────
  async function runVendorPack() {
    setLoading('vendor')
    setError(null)
    try {
      const result = await rfpGenerateVendorPack({ requirements: merged.length ? merged : requirements, vendorContext, company })
      setVendorPack(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  // ── Step 5: Gap analysis ────────────────────────────────────────────────────
  async function runGapAnalysis() {
    setLoading('gap')
    setError(null)
    try {
      const result = await rfpGenerateGapAnalysis({ requirements: merged.length ? merged : requirements, vendorContext, company })
      setGapAnalysis(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      await exportDocx({ health, merged, vendorPack, gapAnalysis, company })
    } catch (e) { setError('Export failed: ' + e.message) }
  }

  // ── Filtered matrix rows ─────────────────────────────────────────────────────
  const matrixRows = merged.filter((r) => {
    if (filterOwner !== 'All' && r.owner !== filterOwner) return false
    if (filterPriority !== 'All' && r.priority !== filterPriority) return false
    return true
  })

  const ownerSummary = classified.reduce((acc, c) => {
    acc[c.owner] = (acc[c.owner] || 0) + 1
    return acc
  }, {})

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: NAVY, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: WHITE }}>RFP / RFI Response Manager</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Extract · Classify · Respond · Export</div>
        </div>
        {merged.length > 0 && (
          <button onClick={handleExport} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 6, color: WHITE, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            ⬇ Export DOCX
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── Setup panel ── */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Company / Prospect</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Vendor Context</label>
              <select
                value={vendorContext}
                onChange={(e) => setVendorContext(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, background: WHITE }}
              >
                <option>LogicGate</option>
                <option>Panorays</option>
                <option>Both</option>
                <option>Unknown</option>
              </select>
            </div>
          </div>

          {/* Paste zone — primary input */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>
                  Document name
                </label>
                <input
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                  placeholder="e.g. Acme RFP Section 3"
                  style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={addPastedDoc}
                disabled={!pasteText.trim()}
                style={{
                  background: pasteText.trim() ? NAVY : '#CBD5E1', color: WHITE,
                  border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13,
                  fontWeight: 600, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                }}
              >
                + Add document
              </button>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste RFP or RFI content here — copy from Word, PDF, email, or any source and paste it in…"
              rows={6}
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* File upload — drag/drop or browse */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px',
              marginBottom: documents.length ? 12 : 0, background: '#FAFBFC',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <span style={{ fontSize: 16 }}>{uploading ? '⏳' : '📎'}</span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {uploading ? 'Uploading and extracting text…' : 'Drop files here — Word (.docx), PDF, Excel (.xlsx), or any text file'}
            </span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ marginLeft: 'auto', fontSize: 12, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '4px 10px', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              Browse
            </button>
            <input ref={fileInputRef} type="file" multiple
              accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.rtf"
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
          </div>

          {documents.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {documents.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: BLUE_LIGHT, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>
                  <span>{d.name}</span>
                  <button onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={runExtract}
              disabled={!documents.length || loading === 'extract'}
              style={{
                background: documents.length && !loading ? NAVY : '#CBD5E1',
                color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px',
                fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading === 'extract' ? 'Extracting…' : '1. Extract Requirements'}
            </button>

            {requirements.length > 0 && (
              <button onClick={runClassify} disabled={!!loading}
                style={{ background: !loading ? '#1D4ED8' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'classify' ? 'Classifying…' : '2. Classify Ownership'}
              </button>
            )}

            {requirements.length > 0 && (
              <button onClick={runResponses} disabled={!!loading}
                style={{ background: !loading ? '#059669' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'respond' ? 'Drafting…' : '3. Draft Responses'}
              </button>
            )}

            {requirements.length > 0 && (
              <button onClick={runVendorPack} disabled={!!loading}
                style={{ background: !loading ? '#7C3AED' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'vendor' ? 'Building pack…' : '4. Vendor Input Pack'}
              </button>
            )}

            {requirements.length > 0 && (
              <button onClick={runGapAnalysis} disabled={!!loading}
                style={{ background: !loading ? '#D97706' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'gap' ? 'Analysing…' : '5. Gap Analysis'}
              </button>
            )}
          </div>

          {loading && <div style={{ marginTop: 12 }}><Spinner /></div>}
          {error && <div style={{ marginTop: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
        </Card>

        {/* ── Health check ── */}
        {health && (
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opportunity Health</div>
                <HealthPill label="RFP Type" value={health.rfp_type} />
                <HealthPill label="LogicGate Fit" value={health.logicgate_fit} />
                <HealthPill label="Panorays Fit" value={health.panorays_fit} />
                <HealthPill label="RR Delivery Fit" value={health.rr_delivery_fit} />
                <HealthPill label="Managed Service Potential" value={health.managed_service_potential} />
                <HealthPill label="Commercial Complexity" value={health.commercial_complexity} />
                {health.response_deadline && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Deadline: {health.response_deadline}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommendation</div>
                <div style={{
                  padding: '12px 16px', borderRadius: 8, marginBottom: 12,
                  background: health.recommended_action === 'Do not proceed' ? '#FEE2E2'
                    : health.recommended_action === 'Proceed' ? '#DCFCE7' : '#FEF9C3',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{health.recommended_action}</div>
                  {health.recommended_action_rationale && (
                    <div style={{ fontSize: 12, color: TEXT, marginTop: 4 }}>{health.recommended_action_rationale}</div>
                  )}
                </div>
                {Array.isArray(health.key_risks) && health.key_risks.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Key Risks</div>
                    {health.key_risks.map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: TEXT, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: RED, marginTop: 1 }}>⚠</span> {r}
                      </div>
                    ))}
                  </>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
                  {requirements.length} requirements extracted
                  {classified.length > 0 && ` · ${classified.length} classified`}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Tabs ── */}
        {requirements.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
              {[
                { id: 'matrix', label: `Requirements (${requirements.length})` },
                { id: 'responses', label: `Responses (${responses.length})`, disabled: !responses.length },
                { id: 'vendor', label: 'Vendor Pack', disabled: !vendorPack },
                { id: 'gap', label: 'Gap Analysis', disabled: !gapAnalysis },
              ].map((tab) => (
                <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  style={{
                    padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none',
                    borderBottom: activeTab === tab.id ? `3px solid ${NAVY}` : '3px solid transparent',
                    color: tab.disabled ? BORDER : activeTab === tab.id ? NAVY : MUTED,
                    cursor: tab.disabled ? 'default' : 'pointer',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Matrix tab ── */}
            {activeTab === 'matrix' && (
              <Card>
                {/* Filters + ownership summary */}
                {classified.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Object.entries(ownerSummary).map(([owner, count]) => (
                        <button key={owner}
                          onClick={() => setFilterOwner(filterOwner === owner ? 'All' : owner)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${ownerColour(owner).text}`,
                            background: filterOwner === owner ? ownerColour(owner).bg : WHITE,
                            color: ownerColour(owner).text,
                          }}>
                          {owner} ({count})
                        </button>
                      ))}
                    </div>
                    <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                      style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                      <option value="All">All priorities</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                    {(filterOwner !== 'All' || filterPriority !== 'All') && (
                      <button onClick={() => { setFilterOwner('All'); setFilterPriority('All') }}
                        style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Clear filters
                      </button>
                    )}
                  </div>
                )}

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: NAVY, color: WHITE }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ID</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Question</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Owner</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Priority</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>M/O</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(classified.length ? matrixRows : requirements.map((r) => ({ ...r }))).map((req, i) => (
                        <React.Fragment key={req.requirement_id || i}>
                          <tr
                            onClick={() => setExpandedRow(expandedRow === (req.requirement_id || i) ? null : (req.requirement_id || i))}
                            style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>{req.requirement_id}</td>
                            <td style={{ padding: '8px 12px', maxWidth: 360 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.original_question}</div>
                            </td>
                            <td style={{ padding: '8px 12px', color: MUTED, whiteSpace: 'nowrap' }}>{req.category}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {req.owner ? <Badge label={req.owner} colour={ownerColour(req.owner)} /> : <span style={{ color: BORDER }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {req.priority ? (
                                <span style={{ display: 'flex', alignItems: 'center' }}>
                                  <SeverityDot s={req.priority} />{req.priority}
                                </span>
                              ) : <span style={{ color: BORDER }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: MUTED }}>{req.mandatory_optional === 'Mandatory' ? 'M' : req.mandatory_optional === 'Optional' ? 'O' : '—'}</td>
                          </tr>
                          {expandedRow === (req.requirement_id || i) && (
                            <tr style={{ background: BLUE_LIGHT }}>
                              <td colSpan={6} style={{ padding: '12px 16px' }}>
                                <div style={{ marginBottom: 8 }}>
                                  <strong>Question:</strong> {req.original_question}
                                </div>
                                {req.notes && <div style={{ marginBottom: 8, color: MUTED }}><strong>Notes:</strong> {req.notes}</div>}
                                {req.rr_response_draft && (
                                  <div style={{ marginBottom: 8 }}>
                                    <strong style={{ color: GREEN }}>RR Draft:</strong>
                                    <div style={{ marginTop: 4, padding: '8px 12px', background: '#F0FDF4', borderRadius: 6, fontSize: 12 }}>{req.rr_response_draft}</div>
                                  </div>
                                )}
                                {req.vendor_prompt && (
                                  <div>
                                    <strong style={{ color: '#7C3AED' }}>Vendor Prompt:</strong>
                                    <div style={{ marginTop: 4, padding: '8px 12px', background: '#F5F3FF', borderRadius: 6, fontSize: 12 }}>{req.vendor_prompt}</div>
                                  </div>
                                )}
                                {req.assumptions && (
                                  <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}><strong>Assumptions:</strong> {req.assumptions}</div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Responses tab ── */}
            {activeTab === 'responses' && responses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {merged.filter((r) => r.rr_response_draft || r.vendor_prompt).map((req, i) => (
                  <Card key={i}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', fontSize: 12 }}>{req.requirement_id}</span>
                      {req.owner && <Badge label={req.owner} colour={ownerColour(req.owner)} />}
                      {req.response_confidence && (
                        <Badge label={`${req.response_confidence} confidence`} colour={{ bg: '#F1F5F9', text: MUTED }} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{req.original_question}</div>
                    {req.rr_response_draft && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 4, textTransform: 'uppercase' }}>RR Draft Response</div>
                        <div style={{ fontSize: 13, color: TEXT, background: '#F0FDF4', padding: '10px 14px', borderRadius: 6, lineHeight: 1.6 }}>{req.rr_response_draft}</div>
                      </div>
                    )}
                    {req.vendor_prompt && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 4, textTransform: 'uppercase' }}>Vendor Prompt</div>
                        <div style={{ fontSize: 12, color: TEXT, background: '#F5F3FF', padding: '8px 12px', borderRadius: 6, lineHeight: 1.5 }}>{req.vendor_prompt}</div>
                      </div>
                    )}
                    {req.assumptions && (
                      <div style={{ fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 8 }}>
                        <strong>Assumptions:</strong> {req.assumptions}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* ── Vendor pack tab ── */}
            {activeTab === 'vendor' && vendorPack && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {vendorPack.summary && (
                  <Card>
                    <div style={{ fontSize: 13, color: TEXT }}>{vendorPack.summary}</div>
                  </Card>
                )}
                {vendorPack.logicgate_pack && (
                  <Card>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', marginBottom: 12 }}>LogicGate Input Request</div>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#FAFBFC', padding: '12px 16px', borderRadius: 6 }}>{vendorPack.logicgate_pack}</div>
                  </Card>
                )}
                {vendorPack.panorays_pack && (
                  <Card>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#BE185D', marginBottom: 12 }}>Panorays Input Request</div>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#FAFBFC', padding: '12px 16px', borderRadius: 6 }}>{vendorPack.panorays_pack}</div>
                  </Card>
                )}
              </div>
            )}

            {/* ── Gap analysis tab ── */}
            {activeTab === 'gap' && gapAnalysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {gapAnalysis.summary && (
                  <Card>
                    <div style={{ fontSize: 13, color: TEXT }}>{gapAnalysis.summary}</div>
                  </Card>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {Array.isArray(gapAnalysis.gaps) && gapAnalysis.gaps.length > 0 && (
                    <Card>
                      <Section title={`Gaps (${gapAnalysis.gaps.length})`}>
                        {gapAnalysis.gaps.map((g, i) => (
                          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < gapAnalysis.gaps.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <SeverityDot s={g.severity} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{g.id} · {g.severity}</span>
                            </div>
                            <div style={{ fontSize: 12, color: TEXT, marginBottom: 4 }}>{g.description}</div>
                            <div style={{ fontSize: 11, color: MUTED }}>→ {g.mitigation}</div>
                          </div>
                        ))}
                      </Section>
                    </Card>
                  )}

                  {Array.isArray(gapAnalysis.risks) && gapAnalysis.risks.length > 0 && (
                    <Card>
                      <Section title={`Risks (${gapAnalysis.risks.length})`}>
                        {gapAnalysis.risks.map((r, i) => (
                          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < gapAnalysis.risks.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <SeverityDot s={r.severity} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{r.id} · {r.owner}</span>
                            </div>
                            <div style={{ fontSize: 12, color: TEXT }}>{r.description}</div>
                          </div>
                        ))}
                      </Section>
                    </Card>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {Array.isArray(gapAnalysis.customer_questions) && gapAnalysis.customer_questions.length > 0 && (
                    <Card>
                      <Section title="Questions for Customer">
                        {gapAnalysis.customer_questions.map((q, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, marginBottom: 8, display: 'flex', gap: 8 }}>
                            <span style={{ color: NAVY, fontWeight: 700 }}>{i + 1}.</span> {q}
                          </div>
                        ))}
                      </Section>
                    </Card>
                  )}
                  {Array.isArray(gapAnalysis.vendor_questions) && gapAnalysis.vendor_questions.length > 0 && (
                    <Card>
                      <Section title="Questions for Vendor">
                        {gapAnalysis.vendor_questions.map((q, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, marginBottom: 8, display: 'flex', gap: 8 }}>
                            <span style={{ color: '#7C3AED', fontWeight: 700 }}>{i + 1}.</span> {q}
                          </div>
                        ))}
                      </Section>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

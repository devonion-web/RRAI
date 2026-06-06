import React, { useState, useRef, useEffect } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ShadingType,
  Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpStoreText,
  rfpExtractRequirements,
  rfpGetJob,
  rfpGenerateMappingPack,
  rfpRegenerateMappingRow,
  rfpRemoveDocument,
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

function confidenceColour(c) {
  if (c === 'High') return GREEN
  if (c === 'Medium') return AMBER
  return RED
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

function tableCell(text, { bold = false } = {}) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold, color: '1E293B' })],
    })],
  })
}

// White-on-navy header cell for tables
function tableCellH(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A', color: 'auto' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold: true, color: 'FFFFFF' })],
    })],
  })
}

// Standard table borders config
const tblBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}

// ── DOCX Export — 12-section RR Mapping Pack ──────────────────────────────────
async function exportMappingDocx({ health, mappingRows, mappingSummary, requirements, company, vendorContext }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── 1. Cover Page ──────────────────────────────────────────────────────────
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'RR RFP Response Mapping Pack', font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text: company || 'Unknown Prospect', font: 'Calibri', size: 36, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: `Prepared by Risk Rising  ·  ${today}`, font: 'Calibri', size: 24, color: '64748B' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'INTERNAL WORKING DOCUMENT — NOT FOR CUSTOMER DISTRIBUTION', font: 'Calibri', size: 20, bold: true, color: 'DC2626' })],
  }))
  children.push(docDivider())
  children.push(docSpacer())

  // ── 2. Opportunity Summary ─────────────────────────────────────────────────
  children.push(docHeaderBar('2. Opportunity Summary'))
  children.push(docSpacer())
  children.push(docLabel('Company / Prospect', company || 'Unknown'))
  children.push(docLabel('Vendor Context', vendorContext || 'Unknown'))
  if (health) {
    const p1 = docLabel('RFP / RFI Type', health.rfp_type)
    if (p1) children.push(p1)
    const p2 = docLabel('Recommended Action', health.recommended_action)
    if (p2) children.push(p2)
    if (health.recommended_action_rationale) children.push(docBody(String(health.recommended_action_rationale)))
  }
  children.push(docLabel('Total Requirements', String(mappingRows.length || (requirements && requirements.length) || '—')))
  children.push(docDivider())
  children.push(docSpacer())

  // ── 3. RFP / RFI Health Assessment ────────────────────────────────────────
  if (health) {
    children.push(docHeaderBar('3. RFP / RFI Health Assessment'))
    children.push(docSpacer())
    ;[
      ['RFP Type', health.rfp_type],
      ['Response Deadline', health.response_deadline || 'Not specified'],
      ['LogicGate Fit', health.logicgate_fit],
      ['Panorays Fit', health.panorays_fit],
      ['RR Delivery Fit', health.rr_delivery_fit],
      ['Managed Service Potential', health.managed_service_potential],
      ['Commercial Complexity', health.commercial_complexity],
    ].filter(([, v]) => v).forEach(([k, v]) => {
      const p = docLabel(k, String(v))
      if (p) children.push(p)
    })
    if (Array.isArray(health.key_risks) && health.key_risks.length) {
      children.push(docSubBar('Key Risks'))
      health.key_risks.forEach((r) => children.push(docBullet(String(r))))
    }
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 4. Ownership Breakdown ─────────────────────────────────────────────────
  children.push(docHeaderBar('4. Ownership Breakdown'))
  children.push(docSpacer())
  if (mappingRows.length) {
    const ownerCounts = mappingRows.reduce((acc, r) => {
      const o = String(r.owner || 'Unknown')
      acc[o] = (acc[o] || 0) + 1
      return acc
    }, {})
    const hdr4 = new TableRow({ tableHeader: true, children: ['Owner', 'Count', '% of Total'].map(tableCellH) })
    const rows4 = Object.entries(ownerCounts).sort().map(([owner, count]) => new TableRow({ children: [
      tableCell(owner),
      tableCell(String(count)),
      tableCell(`${Math.round((count / mappingRows.length) * 100)}%`),
    ]}))
    children.push(new Table({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr4, ...rows4] }))
    children.push(docSpacer())
  }
  children.push(docDivider())
  children.push(docSpacer())

  // ── 5. Requirement Mapping Matrix ─────────────────────────────────────────
  if (mappingRows.length) {
    children.push(docHeaderBar('5. Requirement Mapping Matrix'))
    children.push(docSpacer())
    const hdr5 = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Category', 'Owner', 'Confidence', 'Vendor Required'].map(tableCellH) })
    const rows5 = mappingRows.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.category),
      tableCell(r.owner),
      tableCell(r.confidence),
      tableCell(r.vendor_validation_required ? 'Yes' : 'No'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr5, ...rows5] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 6. RR-Owned Draft Responses ───────────────────────────────────────────
  const rrOwned = mappingRows.filter((r) => r.owner === 'RR' && r.draft_rr_response)
  if (rrOwned.length) {
    children.push(docHeaderBar('6. RR-Owned Draft Responses'))
    children.push(docSpacer())
    const hdr6 = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Draft RR Response', 'Assumptions'].map(tableCellH) })
    const rows6 = rrOwned.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.draft_rr_response),
      tableCell(r.assumptions || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr6, ...rows6] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 7. LogicGate / Panorays Validation Required ───────────────────────────
  const vendorOnly = mappingRows.filter((r) => (r.owner === 'LogicGate' || r.owner === 'Panorays') && r.vendor_validation_required)
  if (vendorOnly.length) {
    children.push(docHeaderBar('7. LogicGate / Panorays Validation Required'))
    children.push(docSpacer())
    const hdr7 = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Vendor', 'Validation Prompt'].map(tableCellH) })
    const rows7 = vendorOnly.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.owner),
      tableCell(r.vendor_question_or_prompt || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr7, ...rows7] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 8. Joint Response Items ────────────────────────────────────────────────
  const jointItems = mappingRows.filter((r) => r.owner === 'Joint')
  if (jointItems.length) {
    children.push(docHeaderBar('8. Joint Response Items'))
    children.push(docSpacer())
    const hdr8 = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'RR Response Element', 'Vendor Validation Needed'].map(tableCellH) })
    const rows8 = jointItems.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.draft_rr_response || '—'),
      tableCell(r.vendor_question_or_prompt || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr8, ...rows8] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 9. Gaps, Risks and Assumptions ────────────────────────────────────────
  if (mappingSummary) {
    children.push(docHeaderBar('9. Gaps, Risks and Assumptions'))
    children.push(docSpacer())
    if (Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length) {
      children.push(docSubBar('Gaps and Risks'))
      mappingSummary.gaps_and_risks.forEach((item) => children.push(docBullet(String(item))))
      children.push(docSpacer())
    }
    if (Array.isArray(mappingSummary.assumptions) && mappingSummary.assumptions.length) {
      children.push(docSubBar('Assumptions'))
      mappingSummary.assumptions.forEach((item) => children.push(docBullet(String(item))))
      children.push(docSpacer())
    }
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 10. Commercial / Delivery Considerations ──────────────────────────────
  if (mappingSummary && Array.isArray(mappingSummary.commercial_delivery_considerations) && mappingSummary.commercial_delivery_considerations.length) {
    children.push(docHeaderBar('10. Commercial / Delivery Considerations'))
    children.push(docSpacer())
    mappingSummary.commercial_delivery_considerations.forEach((item) => children.push(docBullet(String(item))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 11. Recommended Next Actions ──────────────────────────────────────────
  if (mappingSummary && Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length) {
    children.push(docHeaderBar('11. Recommended Next Actions'))
    children.push(docSpacer())
    mappingSummary.recommended_next_actions.forEach((item, i) => {
      children.push(new Paragraph({
        spacing: { after: 80, line: 276 },
        indent: { left: 120 },
        children: [
          new TextRun({ text: `${i + 1}.  `, bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
          new TextRun({ text: clean(String(item)), font: 'Calibri', size: 22, color: '1E293B' }),
        ],
      }))
    })
    children.push(docDivider())
    children.push(docSpacer())
  }

  // ── 12. Appendix: Extracted Requirements ──────────────────────────────────
  if (Array.isArray(requirements) && requirements.length) {
    children.push(docHeaderBar('12. Appendix: Extracted Requirements'))
    children.push(docSpacer())
    const hdr12 = new TableRow({ tableHeader: true, children: ['Ref', 'Source Document', 'Question', 'Category', 'M/O'].map(tableCellH) })
    const rows12 = requirements.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(r.source_document),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.category),
      tableCell(r.mandatory_optional === 'Mandatory' ? 'M' : r.mandatory_optional === 'Optional' ? 'O' : '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr12, ...rows12] }))
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Mapping-Pack-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
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

function Card({ children, style }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '20px 24px', ...style }}>
      {children}
    </div>
  )
}

function Spinner({ label = 'Processing…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
      <div style={{
        width: 16, height: 16, border: `2px solid ${BORDER}`, borderTopColor: NAVY,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      {label}
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

function ProgressBar({ progress, color = NAVY }) {
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 5
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{progress.stage}</span>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
          {progress.done}/{progress.total}
        </span>
      </div>
      <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 3, width: `${pct}%`, transition: 'width 0.4s ease', minWidth: 12 }} />
      </div>
    </div>
  )
}

// ── Owner filter pill ─────────────────────────────────────────────────────────
function OwnerPill({ owner, count, active, onClick }) {
  const col = ownerColour(owner)
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${owner === 'All' ? BORDER : col.text}`,
      background: active ? (owner === 'All' ? NAVY : col.bg) : WHITE,
      color: active ? (owner === 'All' ? WHITE : col.text) : MUTED,
    }}>
      {owner} ({count})
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RFPModule() {
  // Inputs
  const [company, setCompany] = useState('')
  const [vendorContext, setVendorContext] = useState('LogicGate')
  const [documents, setDocuments] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('RFP Document')
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  // Extraction results
  const [health, setHealth] = useState(null)
  const [requirements, setRequirements] = useState([])

  // Mapping pack results
  const [mappingRows, setMappingRows] = useState([])
  const [mappingSummary, setMappingSummary] = useState(null)

  // UI state
  const [loading, setLoading] = useState(null) // 'extract' | 'map' | null
  const [error, setError] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [filterOwner, setFilterOwner] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterConfidence, setFilterConfidence] = useState('All')
  const [regeneratingRow, setRegeneratingRow] = useState(null)

  // Progress tracking
  const [extractProgress, setExtractProgress] = useState(null)
  const [mapProgress, setMapProgress] = useState(null)
  const pollRef = useRef(null)
  const mapPollRef = useRef(null)

  // Clean up polling on unmount
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (mapPollRef.current) clearInterval(mapPollRef.current)
  }, [])

  // Filtered mapping rows
  const visibleRows = mappingRows.filter((r) => {
    if (filterOwner !== 'All' && r.owner !== filterOwner) return false
    if (filterCategory !== 'All' && r.category !== filterCategory) return false
    if (filterConfidence !== 'All' && r.confidence !== filterConfidence) return false
    return true
  })

  // Owner counts for filter pills
  const ownerCounts = ['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].reduce((acc, o) => {
    acc[o] = mappingRows.filter((r) => r.owner === o).length
    return acc
  }, {})

  // Unique categories from mapping rows for filter dropdown
  const categories = [...new Set(mappingRows.map((r) => r.category).filter(Boolean))].sort()

  // ── Add pasted text ──────────────────────────────────────────────────────
  async function addPastedDoc() {
    if (!pasteText.trim()) return
    setUploading(true)
    setError(null)
    try {
      const meta = await rfpStoreText({ name: pasteName || 'RFP Document', text: pasteText.trim() })
      setDocuments((prev) => [...prev, { id: meta.id, name: meta.name, charCount: meta.charCount }])
      setPasteText('')
      setPasteName('RFP Document')
    } catch (e) {
      setError('Failed to store document: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────
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
      const good = parsed.filter((f) => f.id && !f.error)
      const bad = parsed.filter((f) => f.error || !f.id)
      if (good.length) setDocuments((prev) => [...prev, ...good.map((f) => ({
        id: f.id, name: f.name, fileType: f.fileType,
        charCount: f.charCount, rowCount: f.rowCount,
      }))])
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

  // ── Step 1: Extract (job-based) ──────────────────────────────────────────
  async function runExtract() {
    if (!documents.length) return
    setLoading('extract')
    setError(null)
    setExtractProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setRequirements([])
    setHealth(null)
    setMappingRows([])
    setMappingSummary(null)

    try {
      const { jobId } = await rfpExtractRequirements({
        documentIds: documents.map((d) => d.id), vendorContext, company,
      })

      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const job = await rfpGetJob(jobId)
          setExtractProgress(job.progress)
          if (job.status === 'done') {
            clearInterval(pollRef.current); pollRef.current = null
            setHealth(job.health || null)
            setRequirements(job.requirements || [])
            setLoading(null)
            setExtractProgress(null)
          } else if (job.status === 'error') {
            clearInterval(pollRef.current); pollRef.current = null
            setError(job.error || 'Extraction failed')
            setLoading(null)
            setExtractProgress(null)
          }
        } catch { /* network hiccup — keep polling */ }
      }, 2000)
    } catch (e) {
      setError(e.message)
      setLoading(null)
      setExtractProgress(null)
    }
  }

  // ── Step 2: Generate RR Mapping Pack (job-based) ─────────────────────────
  async function runMappingPack() {
    if (!requirements.length) return
    setLoading('map')
    setError(null)
    setMapProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setMappingRows([])
    setMappingSummary(null)

    try {
      const { jobId } = await rfpGenerateMappingPack({ requirements, vendorContext, company })

      if (mapPollRef.current) clearInterval(mapPollRef.current)
      mapPollRef.current = setInterval(async () => {
        try {
          const job = await rfpGetJob(jobId)
          setMapProgress(job.progress)
          if (job.status === 'done') {
            clearInterval(mapPollRef.current); mapPollRef.current = null
            setMappingRows(job.mappingRows || [])
            setMappingSummary(job.mappingSummary || null)
            setLoading(null)
            setMapProgress(null)
          } else if (job.status === 'error') {
            clearInterval(mapPollRef.current); mapPollRef.current = null
            setError(job.error || 'Mapping pack generation failed')
            setLoading(null)
            setMapProgress(null)
          }
        } catch { /* network hiccup — keep polling */ }
      }, 2000)
    } catch (e) {
      setError(e.message)
      setLoading(null)
      setMapProgress(null)
    }
  }

  // ── Inline row update (owner change, response edit, status change) ────────
  function updateMappingRow(requirementId, updates) {
    setMappingRows((prev) => prev.map((r) =>
      r.requirement_id === requirementId ? { ...r, ...updates } : r
    ))
  }

  // ── Regenerate single row via API ─────────────────────────────────────────
  async function regenerateRow(req) {
    setRegeneratingRow(req.requirement_id)
    try {
      const { row } = await rfpRegenerateMappingRow({
        requirement: {
          requirement_id: req.requirement_id,
          source_document: req.source_document,
          original_question: req.original_question,
          category: req.category,
          mandatory_optional: req.mandatory_optional,
        },
        vendorContext,
        company,
      })
      if (row) updateMappingRow(req.requirement_id, row)
    } catch (e) {
      setError('Regenerate failed: ' + e.message)
    } finally {
      setRegeneratingRow(null)
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      await exportMappingDocx({ health, mappingRows, mappingSummary, requirements, company, vendorContext })
    } catch (e) {
      setError('Export failed: ' + e.message)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: NAVY, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: WHITE }}>RFP / RFI Response Manager</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Extract · Map · Own · Validate · Export</div>
        </div>
        {mappingRows.length > 0 && (
          <button onClick={handleExport} style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 6, color: WHITE, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            ⬇ Export Mapping Pack
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px' }}>

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

          {/* Paste zone */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Document name</label>
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
              placeholder="Paste RFP or RFI content here — copy from Word, PDF, email, or any source…"
              rows={5}
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
          </div>

          {/* File upload */}
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

          {/* Document chips */}
          {documents.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 }}>
              {documents.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: BLUE_LIGHT, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>
                  <span style={{ fontSize: 13 }}>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                  <span>{d.name}</span>
                  {d.fileType === 'excel' && d.rowCount
                    ? <span style={{ color: MUTED, fontSize: 11 }}>({d.rowCount} rows)</span>
                    : d.charCount ? <span style={{ color: MUTED, fontSize: 11 }}>({Math.round(d.charCount / 1000)}k chars)</span> : null}
                  <button onClick={() => { rfpRemoveDocument(d.id); setDocuments((prev) => prev.filter((x) => x.id !== d.id)) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Progress bars */}
          {loading === 'extract' && extractProgress && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar progress={extractProgress} color={NAVY} />
            </div>
          )}
          {loading === 'map' && mapProgress && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar progress={mapProgress} color='#059669' />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              onClick={runExtract}
              disabled={!documents.length || !!loading}
              style={{
                background: documents.length && !loading ? NAVY : '#CBD5E1',
                color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px',
                fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading === 'extract' ? 'Extracting…' : '1. Extract Requirements'}
            </button>

            {requirements.length > 0 && (
              <button
                onClick={runMappingPack}
                disabled={!!loading}
                style={{
                  background: !loading ? '#059669' : '#CBD5E1',
                  color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px',
                  fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading === 'map' ? 'Generating…' : `2. Generate RR Mapping Pack (${requirements.length} requirements)`}
              </button>
            )}
          </div>

          {loading && !extractProgress && !mapProgress && (
            <div style={{ marginTop: 12 }}><Spinner /></div>
          )}
          {error && (
            <div style={{ marginTop: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>
          )}
        </Card>

        {/* ── Health card ── */}
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
                        <span style={{ color: AMBER, marginTop: 1 }}>⚠</span> {r}
                      </div>
                    ))}
                  </>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
                  {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} extracted
                  {mappingRows.length > 0 && ` · ${mappingRows.length} mapped`}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Mapping Pack Results ── */}
        {mappingRows.length > 0 && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <OwnerPill owner="All" count={mappingRows.length} active={filterOwner === 'All'} onClick={() => setFilterOwner('All')} />
              {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].filter((o) => ownerCounts[o] > 0).map((o) => (
                <OwnerPill key={o} owner={o} count={ownerCounts[o]} active={filterOwner === o} onClick={() => setFilterOwner(filterOwner === o ? 'All' : o)} />
              ))}

              {categories.length > 0 && (
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, marginLeft: 8 }}>
                  <option value="All">All categories</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}

              <select value={filterConfidence} onChange={(e) => setFilterConfidence(e.target.value)}
                style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                <option value="All">All confidence</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>

              {(filterOwner !== 'All' || filterCategory !== 'All' || filterConfidence !== 'All') && (
                <button onClick={() => { setFilterOwner('All'); setFilterCategory('All'); setFilterConfidence('All') }}
                  style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear filters
                </button>
              )}

              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>
                {visibleRows.length} / {mappingRows.length} requirements
              </span>
            </div>

            {/* Mapping table */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: NAVY, color: WHITE }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Ref</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Question</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Owner</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Conf.</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Vendor?</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '10px 12px', width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((req, i) => (
                      <React.Fragment key={req.requirement_id || i}>
                        <tr
                          onClick={() => setExpandedRow(expandedRow === req.requirement_id ? null : req.requirement_id)}
                          style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}
                        >
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{req.requirement_id}</td>
                          <td style={{ padding: '9px 12px', maxWidth: 340 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>{req.original_question}</div>
                          </td>
                          <td style={{ padding: '9px 12px', color: MUTED, whiteSpace: 'nowrap', fontSize: 11 }}>{req.category}</td>
                          <td style={{ padding: '9px 12px' }}>
                            {req.owner ? <Badge label={req.owner} colour={ownerColour(req.owner)} /> : <span style={{ color: BORDER }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ color: confidenceColour(req.confidence), fontWeight: 600, fontSize: 11 }}>{req.confidence || '—'}</span>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            {req.vendor_validation_required
                              ? <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: 11 }}>Yes</span>
                              : <span style={{ color: MUTED, fontSize: 11 }}>No</span>}
                          </td>
                          <td style={{ padding: '9px 12px', color: MUTED, fontSize: 11 }}>{req.status || 'Draft'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: MUTED, fontSize: 10 }}>
                            {expandedRow === req.requirement_id ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expandedRow === req.requirement_id && (
                          <tr style={{ background: BLUE_LIGHT }}>
                            <td colSpan={8} style={{ padding: '20px 24px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                {/* Left column — mappings */}
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Question</div>
                                  <div style={{ fontSize: 13, color: TEXT, marginBottom: 16, lineHeight: 1.5 }}>{req.original_question}</div>

                                  {req.rr_capability_mapping && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>RR Capability</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#EFF6FF', borderRadius: 6 }}>{req.rr_capability_mapping}</div>
                                    </div>
                                  )}
                                  {req.logicgate_mapping && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LogicGate Mapping</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#F5F3FF', borderRadius: 6 }}>{req.logicgate_mapping}</div>
                                    </div>
                                  )}
                                  {req.panorays_mapping && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#BE185D', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Panorays Mapping</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#FDF2F8', borderRadius: 6 }}>{req.panorays_mapping}</div>
                                    </div>
                                  )}
                                  {req.assumptions && (
                                    <div style={{ marginBottom: 8 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assumptions</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{req.assumptions}</div>
                                    </div>
                                  )}
                                  {req.notes && (
                                    <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}><strong>Note:</strong> {req.notes}</div>
                                  )}
                                </div>

                                {/* Right column — editable fields */}
                                <div>
                                  {/* Owner selector */}
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owner</div>
                                    <select
                                      value={req.owner || 'Unknown'}
                                      onChange={(e) => updateMappingRow(req.requirement_id, { owner: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: WHITE }}
                                    >
                                      {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                  </div>

                                  {/* Draft RR response — editable */}
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft RR Response</div>
                                    <textarea
                                      value={req.draft_rr_response || ''}
                                      onChange={(e) => updateMappingRow(req.requirement_id, { draft_rr_response: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      rows={5}
                                      placeholder="No RR-owned response drafted — vendor-only item"
                                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
                                    />
                                  </div>

                                  {/* Vendor validation prompt — editable */}
                                  {(req.vendor_validation_required || req.vendor_question_or_prompt) && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Vendor Validation Required
                                      </div>
                                      <textarea
                                        value={req.vendor_question_or_prompt || ''}
                                        onChange={(e) => updateMappingRow(req.requirement_id, { vendor_question_or_prompt: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                        rows={3}
                                        placeholder="Vendor validation question or prompt…"
                                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #DDD6FE', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, background: '#F5F3FF' }}
                                      />
                                    </div>
                                  )}

                                  {/* Status selector */}
                                  <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                                    <select
                                      value={req.status || 'Draft'}
                                      onChange={(e) => updateMappingRow(req.requirement_id, { status: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: WHITE }}
                                    >
                                      <option>Draft</option>
                                      <option>Ready</option>
                                      <option>Needs Review</option>
                                    </select>
                                  </div>

                                  {/* Regenerate button */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); regenerateRow(req) }}
                                    disabled={!!regeneratingRow}
                                    style={{
                                      background: regeneratingRow === req.requirement_id ? '#CBD5E1' : '#F1F5F9',
                                      border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 16px',
                                      fontSize: 12, cursor: regeneratingRow ? 'not-allowed' : 'pointer', color: NAVY, fontWeight: 600,
                                    }}
                                  >
                                    {regeneratingRow === req.requirement_id ? '⟳ Regenerating…' : '⟳ Regenerate this row'}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pack summary (gaps, risks, next actions) */}
              {mappingSummary && (
                <div style={{ padding: '24px 24px', borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pack Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {[
                      { key: 'gaps_and_risks', label: 'Gaps & Risks', icon: '⚠', iconColor: AMBER },
                      { key: 'assumptions', label: 'Assumptions', icon: '•', iconColor: MUTED },
                      { key: 'commercial_delivery_considerations', label: 'Commercial / Delivery', icon: '₤', iconColor: NAVY },
                      { key: 'recommended_next_actions', label: 'Recommended Next Actions', icon: '✓', iconColor: GREEN },
                    ].map(({ key, label, icon, iconColor }) => {
                      const items = mappingSummary[key]
                      if (!Array.isArray(items) || !items.length) return null
                      return (
                        <div key={key}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{label}</div>
                          {items.map((item, j) => (
                            <div key={j} style={{ fontSize: 12, color: TEXT, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
                              <span style={{ color: iconColor, marginTop: 1, flexShrink: 0 }}>{icon}</span>
                              {item}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Empty state after extraction, before mapping ── */}
        {requirements.length > 0 && mappingRows.length === 0 && loading !== 'map' && (
          <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
              {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} extracted
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
              Click <strong>2. Generate RR Mapping Pack</strong> to classify ownership, draft RR responses, identify vendor validation requirements, and produce the full working document.
            </div>
            <button
              onClick={runMappingPack}
              disabled={!!loading}
              style={{
                background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '10px 24px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Generate RR Mapping Pack →
            </button>
          </Card>
        )}

      </div>
    </div>
  )
}

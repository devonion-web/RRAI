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

// ── Colours ───────────────────────────────────────────────────────────────────
const NAVY      = '#0B1F3A'
const BLUE_LIGHT = '#EAF1F8'
const TEXT      = '#1E293B'
const MUTED     = '#64748B'
const BORDER    = '#E2E8F0'
const GREEN     = '#16A34A'
const AMBER     = '#D97706'
const RED       = '#DC2626'
const WHITE     = '#FFFFFF'

// ── Badge colour helpers ──────────────────────────────────────────────────────
function ownerColour(owner) {
  switch (owner) {
    case 'RR':           return { bg: '#DBEAFE', text: '#1D4ED8' }
    case 'LogicGate':    return { bg: '#F3E8FF', text: '#7C3AED' }
    case 'Panorays':     return { bg: '#FCE7F3', text: '#BE185D' }
    case 'Joint':        return { bg: '#D1FAE5', text: '#065F46' }
    case 'Not Relevant': return { bg: '#F1F5F9', text: '#94A3B8' }
    default:             return { bg: '#F1F5F9', text: '#64748B' }
  }
}

function confidenceColour(c) {
  switch (c) {
    case 'High':   return { text: GREEN,  bg: '#DCFCE7' }
    case 'Medium': return { text: AMBER,  bg: '#FEF9C3' }
    default:       return { text: RED,    bg: '#FEE2E2' }
  }
}

function relevanceColour(r) {
  switch (r) {
    case 'Relevant':     return { bg: '#DCFCE7', text: '#15803D' }
    case 'Not Relevant': return { bg: '#F1F5F9', text: '#94A3B8' }
    default:             return { bg: '#FEF9C3', text: '#A16207' }
  }
}

function docTypeColour(dt) {
  const map = {
    'Requirements Matrix':      { bg: '#DBEAFE', text: '#1D4ED8' },
    'RFP Overview':             { bg: '#D1FAE5', text: '#065F46' },
    'Scope Document':           { bg: '#F3E8FF', text: '#7C3AED' },
    'Evaluation Criteria':      { bg: '#FEF9C3', text: '#A16207' },
    'Procurement Instructions': { bg: '#E0F2FE', text: '#0369A1' },
    'Commercial Requirements':  { bg: '#FCE7F3', text: '#BE185D' },
    'Security Requirements':    { bg: '#FEE2E2', text: '#991B1B' },
    'Supporting Material':      { bg: '#F1F5F9', text: '#475569' },
  }
  return map[dt] || { bg: '#F1F5F9', text: '#64748B' }
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

function tableCell(text, { bold = false, shade = null } = {}) {
  const cell = new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold, color: '1E293B' })],
    })],
  })
  return cell
}

function tableCellH(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A', color: 'auto' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold: true, color: 'FFFFFF' })],
    })],
  })
}

const tblBorders = {
  top:     { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom:  { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left:    { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right:   { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}

// ── DOCX Export — Triage Report ───────────────────────────────────────────────
async function exportTriageDocx({ assessment, requirements, company, vendorContext }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const a = assessment || {}
  const relevant    = (requirements || []).filter((r) => r.relevance !== 'Not Relevant')
  const notRelevant = (requirements || []).filter((r) => r.relevance === 'Not Relevant')
  const needsVendor = (requirements || []).filter((r) => r.vendor_validation_required)

  // Cover
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'RFP / RFI Triage Report', font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
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

  // Summary
  children.push(docHeaderBar('1. Triage Summary'))
  children.push(docSpacer())
  if (a.triage_summary) children.push(docBody(a.triage_summary))
  children.push(docSpacer())
  const pTotal = docLabel('Total requirements', String((requirements || []).length))
  if (pTotal) children.push(pTotal)
  const pRel = docLabel('Requiring response', String(relevant.length))
  if (pRel) children.push(pRel)
  const pVend = docLabel('Requiring vendor validation', String(needsVendor.length))
  if (pVend) children.push(pVend)
  const pNot = docLabel('Not relevant', String(notRelevant.length))
  if (pNot) children.push(pNot)
  children.push(docDivider())
  children.push(docSpacer())

  // Worklist
  if (relevant.length) {
    children.push(docHeaderBar('2. Requirement Worklist'))
    children.push(docSpacer())
    const hdr = new TableRow({
      tableHeader: true,
      children: ['Ref', 'Requirement', 'Why Relevant', 'Owner', 'LG Mapping', 'Response Req', 'Vendor Val', 'Confidence'].map(tableCellH),
    })
    const rows = relevant.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 180) : ''),
      tableCell(r.why_relevant || '—'),
      tableCell(r.recommended_owner || '—'),
      tableCell(r.logicgate_mapping || '—'),
      tableCell(r.response_required ? 'Y' : 'N'),
      tableCell(r.vendor_validation_required ? 'Y' : 'N'),
      tableCell(r.confidence || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Gaps
  if (Array.isArray(a.gaps) && a.gaps.length) {
    children.push(docHeaderBar('3. Gaps and Uncertainties'))
    children.push(docSpacer())
    a.gaps.forEach((g) => children.push(docBullet(String(g))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Clarification needed
  if (Array.isArray(a.clarification_needed) && a.clarification_needed.length) {
    children.push(docHeaderBar('4. Clarification Required'))
    children.push(docSpacer())
    a.clarification_needed.forEach((q) => children.push(docBullet(String(q))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Vendor validation items
  if (needsVendor.length) {
    children.push(docHeaderBar('5. Vendor Validation Required'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Requirement', 'Owner'].map(tableCellH) })
    const rows = needsVendor.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.recommended_owner || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Not relevant
  if (notRelevant.length) {
    children.push(docHeaderBar('6. Not Relevant'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Requirement', 'Notes'].map(tableCellH) })
    const rows = notRelevant.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.notes || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Triage-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── DOCX Export — Mapping Pack ────────────────────────────────────────────────
async function exportMappingDocx({ assessment, mappingRows, mappingSummary, requirements, company, vendorContext }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const a = assessment || {}

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

  // Triage summary
  if (a.triage_summary) {
    children.push(docHeaderBar('1. Triage Summary'))
    children.push(docSpacer())
    children.push(docBody(a.triage_summary))
    const p1 = docLabel('Total requirements', String(mappingRows.length || (requirements && requirements.length) || '—'))
    if (p1) children.push(p1)
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Ownership breakdown
  children.push(docHeaderBar('2. Ownership Breakdown'))
  children.push(docSpacer())
  if (mappingRows.length) {
    const ownerCounts = mappingRows.reduce((acc, r) => {
      const o = String(r.owner || 'Unknown'); acc[o] = (acc[o] || 0) + 1; return acc
    }, {})
    const hdr = new TableRow({ tableHeader: true, children: ['Owner', 'Count', '% of Total'].map(tableCellH) })
    const rows = Object.entries(ownerCounts).sort().map(([owner, count]) => new TableRow({ children: [
      tableCell(owner), tableCell(String(count)), tableCell(`${Math.round((count / mappingRows.length) * 100)}%`),
    ]}))
    children.push(new Table({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
  }
  children.push(docDivider())
  children.push(docSpacer())

  // Mapping matrix
  if (mappingRows.length) {
    children.push(docHeaderBar('3. Requirement Mapping Matrix'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Category', 'Owner', 'Confidence', 'Vendor Required'].map(tableCellH) })
    const rows = mappingRows.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.category), tableCell(r.owner), tableCell(r.confidence),
      tableCell(r.vendor_validation_required ? 'Yes' : 'No'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // RR draft responses
  const rrOwned = mappingRows.filter((r) => r.owner === 'RR' && r.draft_rr_response)
  if (rrOwned.length) {
    children.push(docHeaderBar('4. RR-Owned Draft Responses'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Draft RR Response', 'Assumptions'].map(tableCellH) })
    const rows = rrOwned.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.draft_rr_response), tableCell(r.assumptions || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Vendor validation
  const vendorItems = mappingRows.filter((r) => (r.owner === 'LogicGate' || r.owner === 'Panorays') && r.vendor_validation_required)
  if (vendorItems.length) {
    children.push(docHeaderBar('5. Vendor Validation Required'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Vendor', 'Validation Prompt'].map(tableCellH) })
    const rows = vendorItems.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.owner), tableCell(r.vendor_question_or_prompt || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Joint
  const jointItems = mappingRows.filter((r) => r.owner === 'Joint')
  if (jointItems.length) {
    children.push(docHeaderBar('6. Joint Response Items'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'RR Response Element', 'Vendor Input Needed'].map(tableCellH) })
    const rows = jointItems.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tableCell(r.draft_rr_response || '—'), tableCell(r.vendor_question_or_prompt || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Pack summary
  if (mappingSummary) {
    if (Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length) {
      children.push(docHeaderBar('7. Gaps and Risks'))
      children.push(docSpacer())
      mappingSummary.gaps_and_risks.forEach((item) => children.push(docBullet(String(item))))
      children.push(docDivider())
      children.push(docSpacer())
    }
    if (Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length) {
      children.push(docHeaderBar('8. Recommended Next Actions'))
      children.push(docSpacer())
      mappingSummary.recommended_next_actions.forEach((item, i) => children.push(new Paragraph({
        spacing: { after: 80, line: 276 }, indent: { left: 120 },
        children: [
          new TextRun({ text: `${i + 1}.  `, bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
          new TextRun({ text: clean(String(item)), font: 'Calibri', size: 22, color: '1E293B' }),
        ],
      })))
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Mapping-Pack-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── UI Components ─────────────────────────────────────────────────────────────
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

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
      <div style={{ width: 16, height: 16, border: `2px solid ${BORDER}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Processing…
    </div>
  )
}

function ProgressBar({ progress, color = NAVY }) {
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 5
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{progress.stage}</span>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{progress.done}/{progress.total}</span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s ease', minWidth: 8 }} />
      </div>
    </div>
  )
}

function StatBox({ label, count, colour }) {
  return (
    <div style={{ padding: '12px 18px', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: colour || NAVY, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
    </div>
  )
}

function YN({ value }) {
  return value
    ? <span style={{ fontWeight: 700, color: GREEN, fontSize: 12 }}>Y</span>
    : <span style={{ color: MUTED, fontSize: 12 }}>N</span>
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RFPModule() {
  const [company, setCompany] = useState('')
  const [vendorContext, setVendorContext] = useState('LogicGate')
  const [documents, setDocuments] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('RFP Document')
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const [assessment, setAssessment] = useState(null)
  const [rfpUnderstanding, setRfpUnderstanding] = useState(null)
  const [documentClassifications, setDocumentClassifications] = useState([])
  const [requirements, setRequirements] = useState([])

  const [mappingRows, setMappingRows] = useState([])
  const [mappingSummary, setMappingSummary] = useState(null)

  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  // Worklist filters
  const [wlFilter, setWlFilter] = useState('relevant')  // 'all' | 'relevant' | 'vendor' | 'uncertain' | 'low'
  const [wlOwner, setWlOwner] = useState('All')
  const [wlExpanded, setWlExpanded] = useState(null)

  // Mapping filters
  const [mapFilterOwner, setMapFilterOwner] = useState('All')
  const [mapFilterCategory, setMapFilterCategory] = useState('All')
  const [mapFilterConfidence, setMapFilterConfidence] = useState('All')
  const [mapExpanded, setMapExpanded] = useState(null)
  const [regeneratingRow, setRegeneratingRow] = useState(null)

  const [extractProgress, setExtractProgress] = useState(null)
  const [mapProgress, setMapProgress] = useState(null)
  const pollRef = useRef(null)
  const mapPollRef = useRef(null)

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (mapPollRef.current) clearInterval(mapPollRef.current)
  }, [])

  // Derived counts
  const counts = {
    total:    requirements.length,
    relevant: requirements.filter((r) => r.relevance === 'Relevant').length,
    response: requirements.filter((r) => r.response_required).length,
    vendor:   requirements.filter((r) => r.vendor_validation_required).length,
    uncertain: requirements.filter((r) => r.relevance === 'Uncertain').length,
    low:      requirements.filter((r) => r.confidence === 'Low').length,
    notRel:   requirements.filter((r) => r.relevance === 'Not Relevant').length,
  }

  // Filtered worklist
  const baseList = (() => {
    switch (wlFilter) {
      case 'relevant':  return requirements.filter((r) => r.relevance === 'Relevant')
      case 'vendor':    return requirements.filter((r) => r.vendor_validation_required)
      case 'uncertain': return requirements.filter((r) => r.relevance === 'Uncertain' || r.confidence === 'Low')
      case 'notrel':    return requirements.filter((r) => r.relevance === 'Not Relevant')
      default:          return requirements
    }
  })()
  const visibleList = wlOwner === 'All' ? baseList : baseList.filter((r) => r.recommended_owner === wlOwner)

  const wlOwners = ['All', ...Array.from(new Set(requirements.map((r) => r.recommended_owner).filter(Boolean)))]

  // Mapping table filtered
  const visibleMapping = mappingRows.filter((r) => {
    if (mapFilterOwner !== 'All' && r.owner !== mapFilterOwner) return false
    if (mapFilterCategory !== 'All' && r.category !== mapFilterCategory) return false
    if (mapFilterConfidence !== 'All' && r.confidence !== mapFilterConfidence) return false
    return true
  })
  const mapOwnerCounts = ['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].reduce((acc, o) => {
    acc[o] = mappingRows.filter((r) => r.owner === o).length; return acc
  }, {})
  const mapCategories = [...new Set(mappingRows.map((r) => r.category).filter(Boolean))].sort()

  function getDocType(docId) {
    return documentClassifications.find((c) => c.id === docId)?.docType || null
  }

  async function addPastedDoc() {
    if (!pasteText.trim()) return
    setUploading(true); setError(null)
    try {
      const meta = await rfpStoreText({ name: pasteName || 'RFP Document', text: pasteText.trim() })
      setDocuments((p) => [...p, { id: meta.id, name: meta.name, charCount: meta.charCount }])
      setPasteText(''); setPasteName('RFP Document')
    } catch (e) { setError('Failed to store document: ' + e.message) }
    finally { setUploading(false) }
  }

  async function handleFiles(files) {
    if (!files.length) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/rfp/upload-files', { method: 'POST', body: fd })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Upload failed: ${res.status}`) }
      const { files: parsed } = await res.json()
      const good = parsed.filter((f) => f.id && !f.error)
      const bad  = parsed.filter((f) => f.error || !f.id)
      if (good.length) setDocuments((p) => [...p, ...good.map((f) => ({ id: f.id, name: f.name, fileType: f.fileType, charCount: f.charCount, rowCount: f.rowCount }))])
      if (bad.length)  setError(`Could not extract: ${bad.map((f) => f.name).join(', ')}`)
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  function handleDrop(e) { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files; if (f?.length) handleFiles(Array.from(f)) }
  function handleDragOver(e) { e.preventDefault(); e.stopPropagation() }

  async function runTriage() {
    if (!documents.length) return
    setLoading('extract'); setError(null)
    setExtractProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setRequirements([]); setAssessment(null); setRfpUnderstanding(null)
    setDocumentClassifications([]); setMappingRows([]); setMappingSummary(null)
    setWlExpanded(null); setMapExpanded(null)

    try {
      const { jobId } = await rfpExtractRequirements({ documentIds: documents.map((d) => d.id), vendorContext, company })
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const job = await rfpGetJob(jobId)
          setExtractProgress(job.progress)
          if (job.status === 'done') {
            clearInterval(pollRef.current); pollRef.current = null
            setAssessment(job.assessment || null)
            setRfpUnderstanding(job.rfpUnderstanding || null)
            setDocumentClassifications(job.documentClassifications || [])
            setRequirements(job.requirements || [])
            setLoading(null); setExtractProgress(null)
          } else if (job.status === 'error') {
            clearInterval(pollRef.current); pollRef.current = null
            setError(job.error || 'Triage failed'); setLoading(null); setExtractProgress(null)
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setExtractProgress(null) }
  }

  async function runMappingPack() {
    if (!requirements.length) return
    setLoading('map'); setError(null)
    setMapProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setMappingRows([]); setMappingSummary(null); setMapExpanded(null)

    try {
      const { jobId } = await rfpGenerateMappingPack({ requirements, vendorContext, company, rfpUnderstanding })
      if (mapPollRef.current) clearInterval(mapPollRef.current)
      mapPollRef.current = setInterval(async () => {
        try {
          const job = await rfpGetJob(jobId)
          setMapProgress(job.progress)
          if (job.status === 'done') {
            clearInterval(mapPollRef.current); mapPollRef.current = null
            setMappingRows(job.mappingRows || [])
            setMappingSummary(job.mappingSummary || null)
            setLoading(null); setMapProgress(null)
          } else if (job.status === 'error') {
            clearInterval(mapPollRef.current); mapPollRef.current = null
            setError(job.error || 'Mapping pack failed'); setLoading(null); setMapProgress(null)
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setMapProgress(null) }
  }

  function updateMappingRow(id, updates) {
    setMappingRows((p) => p.map((r) => r.requirement_id === id ? { ...r, ...updates } : r))
  }

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
          why_relevant: req.why_relevant,
          recommended_owner: req.recommended_owner,
          logicgate_mapping: req.logicgate_mapping,
          rr_mapping: req.rr_mapping,
          confidence: req.confidence,
        },
        vendorContext, company, rfpUnderstanding,
      })
      if (row) updateMappingRow(req.requirement_id, row)
    } catch (e) { setError('Regenerate failed: ' + e.message) }
    finally { setRegeneratingRow(null) }
  }

  const hasTriage = requirements.length > 0
  const hasMappingPack = mappingRows.length > 0

  // Tab filter config
  const tabs = [
    { key: 'relevant',  label: 'Relevant',          count: counts.relevant },
    { key: 'vendor',    label: 'Vendor Validation',  count: counts.vendor },
    { key: 'uncertain', label: 'Uncertain / Review', count: counts.uncertain + counts.low },
    { key: 'notrel',    label: 'Not Relevant',       count: counts.notRel },
    { key: 'all',       label: 'All',                count: counts.total },
  ]

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: NAVY, padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: WHITE }}>RFP / RFI Response Manager</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Triage · Map · Own · Validate · Export</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasTriage && (
            <button
              onClick={() => exportTriageDocx({ assessment, requirements, company, vendorContext }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: WHITE, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Triage Report
            </button>
          )}
          {hasMappingPack && (
            <button
              onClick={() => exportMappingDocx({ assessment, mappingRows, mappingSummary, requirements, company, vendorContext }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: WHITE, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Mapping Pack
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px' }}>

        {/* Setup card */}
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Company / Prospect</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp"
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor Context</label>
              <select value={vendorContext} onChange={(e) => setVendorContext(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, background: WHITE }}>
                <option>LogicGate</option>
                <option>Panorays</option>
                <option>Both</option>
                <option>Unknown</option>
              </select>
            </div>
          </div>

          {/* Paste zone */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document name</label>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="e.g. Acme RFP Section 3"
                  style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={addPastedDoc} disabled={!pasteText.trim()}
                style={{ background: pasteText.trim() ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                + Add
              </button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste RFP or RFI content here…"
              rows={3}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          {/* File drop zone */}
          <div onDrop={handleDrop} onDragOver={handleDragOver}
            style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '8px 16px', marginBottom: documents.length ? 10 : 0, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>{uploading ? '⏳' : '📎'}</span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {uploading ? 'Uploading…' : 'Drop files — Word, PDF, Excel, text'}
            </span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              Browse
            </button>
            <input ref={fileInputRef} type="file" multiple
              accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.rtf"
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
          </div>

          {/* Document chips */}
          {documents.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14 }}>
              {documents.map((d) => {
                const dt = getDocType(d.id)
                const dtCol = dt ? docTypeColour(dt) : null
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: BLUE_LIGHT, borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                    <span style={{ fontSize: 12 }}>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                    <span>{d.name}</span>
                    {dt && <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: dtCol.bg, color: dtCol.text }}>{dt}</span>}
                    {d.fileType === 'excel' && d.rowCount
                      ? <span style={{ color: MUTED, fontSize: 10 }}>({d.rowCount} rows)</span>
                      : d.charCount ? <span style={{ color: MUTED, fontSize: 10 }}>({Math.round(d.charCount / 1000)}k chars)</span> : null}
                    <button onClick={() => { rfpRemoveDocument(d.id); setDocuments((p) => p.filter((x) => x.id !== d.id)) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress */}
          {loading === 'extract' && extractProgress && <div style={{ marginTop: 10 }}><ProgressBar progress={extractProgress} color={NAVY} /></div>}
          {loading === 'map' && mapProgress && <div style={{ marginTop: 10 }}><ProgressBar progress={mapProgress} color='#059669' /></div>}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button onClick={runTriage} disabled={!documents.length || !!loading}
              style={{ background: documents.length && !loading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed' }}>
              {loading === 'extract' ? 'Triaging…' : '1. Triage Requirements'}
            </button>
            {hasTriage && (
              <button onClick={runMappingPack} disabled={!!loading}
                style={{ background: !loading ? '#059669' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'map' ? 'Generating…' : `2. Generate Mapping Pack (${counts.response} requirements)`}
              </button>
            )}
          </div>

          {loading && !extractProgress && !mapProgress && <div style={{ marginTop: 10 }}><Spinner /></div>}
          {error && <div style={{ marginTop: 10, color: RED, fontSize: 12, background: '#FEE2E2', padding: '7px 12px', borderRadius: 6 }}>{error}</div>}
        </Card>

        {/* ════════════════════════════════════════════════════ */}
        {/* TRIAGE RESULTS                                      */}
        {/* ════════════════════════════════════════════════════ */}
        {hasTriage && (
          <>
            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatBox label="Requirements found"    count={counts.total}     colour={NAVY} />
              <StatBox label="Relevant / respond"    count={counts.response}  colour={GREEN} />
              <StatBox label="Vendor validation"     count={counts.vendor}    colour='#7C3AED' />
              <StatBox label="Uncertain / review"    count={counts.uncertain + counts.low} colour={AMBER} />
              <StatBox label="Not relevant"          count={counts.notRel}    colour={MUTED} />
            </div>

            {/* Triage summary (1–2 lines) */}
            {assessment?.triage_summary && (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '12px 18px', marginBottom: 16, fontSize: 13, color: TEXT, lineHeight: 1.6 }}>
                {assessment.triage_summary}
              </div>
            )}

            {/* Worklist tab filter */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: `1px solid ${BORDER}`, background: WHITE, borderRadius: '6px 6px 0 0', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => { setWlFilter(tab.key); setWlExpanded(null) }}
                  style={{
                    padding: '10px 16px', fontSize: 12, fontWeight: wlFilter === tab.key ? 700 : 500,
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: wlFilter === tab.key ? NAVY : WHITE,
                    color: wlFilter === tab.key ? WHITE : MUTED,
                    borderRight: `1px solid ${BORDER}`,
                  }}>
                  {tab.label} <span style={{ fontWeight: 400, opacity: 0.75 }}>({tab.count})</span>
                </button>
              ))}
              {/* Owner filter */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 12px', borderLeft: `1px solid ${BORDER}` }}>
                <select value={wlOwner} onChange={(e) => setWlOwner(e.target.value)}
                  style={{ border: 'none', fontSize: 12, color: TEXT, background: 'transparent', cursor: 'pointer' }}>
                  {wlOwners.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Worklist table */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: `2px solid ${BORDER}` }}>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ref</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Requirement</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Why Relevant</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owner</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LG Mapping</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resp.</th>
                      <th style={{ padding: '9px 12px', textAlign: 'center', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor</th>
                      <th style={{ padding: '9px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conf.</th>
                      <th style={{ width: 24 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleList.map((req, i) => {
                      const confCol = confidenceColour(req.confidence)
                      const isExpanded = wlExpanded === req.requirement_id
                      return (
                        <React.Fragment key={req.requirement_id || i}>
                          <tr
                            onClick={() => setWlExpanded(isExpanded ? null : req.requirement_id)}
                            style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: isExpanded ? BLUE_LIGHT : (i % 2 === 0 ? WHITE : '#FAFBFC') }}>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', fontSize: 11 }}>{req.requirement_id}</td>
                            <td style={{ padding: '9px 12px', maxWidth: 260 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>{req.original_question}</div>
                            </td>
                            <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                              {req.why_relevant
                                ? <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MUTED }}>{req.why_relevant}</div>
                                : <span style={{ color: BORDER }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                              <Badge label={req.recommended_owner || '—'} colour={ownerColour(req.recommended_owner)} />
                            </td>
                            <td style={{ padding: '9px 12px', maxWidth: 200 }}>
                              {req.logicgate_mapping
                                ? <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT, fontSize: 11 }}>{req.logicgate_mapping}</div>
                                : <span style={{ color: BORDER }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}><YN value={req.response_required} /></td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}><YN value={req.vendor_validation_required} /></td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontWeight: 600, fontSize: 11, color: confCol.text }}>{req.confidence || '—'}</span>
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'center', color: MUTED, fontSize: 9 }}>{isExpanded ? '▲' : '▼'}</td>
                          </tr>

                          {/* Expanded row */}
                          {isExpanded && (
                            <tr style={{ background: BLUE_LIGHT }}>
                              <td colSpan={9} style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Full Requirement</div>
                                    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, padding: '10px 12px', background: WHITE, borderRadius: 5, border: `1px solid ${BORDER}`, marginBottom: 12 }}>{req.original_question}</div>
                                    {req.why_relevant && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Why Relevant</div>
                                        <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{req.why_relevant}</div>
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: MUTED }}>
                                      {req.source_document && <span><strong>Source:</strong> {req.source_document}</span>}
                                      {req.category && <span><strong>Category:</strong> {req.category}</span>}
                                      {req.mandatory_optional && <span><strong>M/O:</strong> {req.mandatory_optional}</span>}
                                    </div>
                                  </div>
                                  <div>
                                    {req.logicgate_mapping && (
                                      <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>LogicGate Mapping</div>
                                        <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#F5F3FF', borderRadius: 5 }}>{req.logicgate_mapping}</div>
                                      </div>
                                    )}
                                    {req.rr_mapping && (
                                      <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>RR Mapping</div>
                                        <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#EFF6FF', borderRadius: 5 }}>{req.rr_mapping}</div>
                                      </div>
                                    )}
                                    {req.notes && (
                                      <div style={{ padding: '8px 12px', background: '#FFFBEB', borderRadius: 5, border: `1px solid #FDE68A`, fontSize: 12, color: TEXT }}>
                                        <strong style={{ color: AMBER }}>⚠ </strong>{req.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {visibleList.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No requirements in this filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 14px', borderTop: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, background: '#FAFBFC' }}>
                Showing {visibleList.length} of {requirements.length} requirements
              </div>
            </div>

            {/* Gaps & Clarification */}
            {assessment && (
              (Array.isArray(assessment.gaps) && assessment.gaps.length > 0) ||
              (Array.isArray(assessment.clarification_needed) && assessment.clarification_needed.length > 0) ||
              (Array.isArray(assessment.items_flagged_for_review) && assessment.items_flagged_for_review.length > 0)
            ) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {Array.isArray(assessment?.gaps) && assessment.gaps.length > 0 && (
                  <Card style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Gaps & Uncertainties</div>
                    {assessment.gaps.map((g, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                        <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {g}
                      </div>
                    ))}
                    {Array.isArray(assessment.items_flagged_for_review) && assessment.items_flagged_for_review.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 12, marginBottom: 8 }}>Flagged for Review</div>
                        {assessment.items_flagged_for_review.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>• {item}</div>
                        ))}
                      </>
                    )}
                  </Card>
                )}
                {Array.isArray(assessment?.clarification_needed) && assessment.clarification_needed.length > 0 && (
                  <Card style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Clarification Required</div>
                    {assessment.clarification_needed.map((q, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                        <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>Q{i + 1}</span> {q}
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* MAPPING PACK RESULTS                                */}
        {/* ════════════════════════════════════════════════════ */}
        {hasMappingPack && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
              Mapping Pack — {mappingRows.length} requirements mapped
            </div>

            {/* Mapping filter bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setMapFilterOwner('All')}
                style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${mapFilterOwner === 'All' ? NAVY : BORDER}`, background: mapFilterOwner === 'All' ? NAVY : WHITE, color: mapFilterOwner === 'All' ? WHITE : MUTED }}>
                All ({mappingRows.length})
              </button>
              {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].filter((o) => mapOwnerCounts[o] > 0).map((o) => {
                const col = ownerColour(o); const active = mapFilterOwner === o
                return (
                  <button key={o} onClick={() => setMapFilterOwner(active ? 'All' : o)}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? col.text : BORDER}`, background: active ? col.bg : WHITE, color: active ? col.text : MUTED }}>
                    {o} ({mapOwnerCounts[o]})
                  </button>
                )
              })}
              {mapCategories.length > 0 && (
                <select value={mapFilterCategory} onChange={(e) => setMapFilterCategory(e.target.value)}
                  style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, marginLeft: 6 }}>
                  <option value="All">All categories</option>
                  {mapCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              <select value={mapFilterConfidence} onChange={(e) => setMapFilterConfidence(e.target.value)}
                style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                <option value="All">All confidence</option>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{visibleMapping.length} / {mappingRows.length}</span>
            </div>

            {/* Mapping table */}
            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: NAVY, color: WHITE }}>
                      {['Ref', 'Question', 'Category', 'Owner', 'Conf.', 'Vendor?', 'Status', ''].map((h, i) => (
                        <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: i === 1 ? 'normal' : 'nowrap', width: i === 7 ? 28 : 'auto' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMapping.map((req, i) => (
                      <React.Fragment key={req.requirement_id || i}>
                        <tr onClick={() => setMapExpanded(mapExpanded === req.requirement_id ? null : req.requirement_id)}
                          style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', fontSize: 11 }}>{req.requirement_id}</td>
                          <td style={{ padding: '8px 12px', maxWidth: 340 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>{req.original_question}</div>
                          </td>
                          <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11, whiteSpace: 'nowrap' }}>{req.category}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {req.owner ? <Badge label={req.owner} colour={ownerColour(req.owner)} /> : <span style={{ color: BORDER }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontWeight: 600, fontSize: 11, color: confidenceColour(req.confidence).text }}>{req.confidence || '—'}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}><YN value={req.vendor_validation_required} /></td>
                          <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11 }}>{req.status || 'Draft'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: MUTED, fontSize: 9 }}>
                            {mapExpanded === req.requirement_id ? '▲' : '▼'}
                          </td>
                        </tr>

                        {mapExpanded === req.requirement_id && (
                          <tr style={{ background: BLUE_LIGHT }}>
                            <td colSpan={8} style={{ padding: '18px 22px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Question</div>
                                  <div style={{ fontSize: 13, color: TEXT, marginBottom: 14, lineHeight: 1.5 }}>{req.original_question}</div>
                                  {req.rr_capability_mapping && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RR Capability</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 10px', background: '#EFF6FF', borderRadius: 5 }}>{req.rr_capability_mapping}</div>
                                    </div>
                                  )}
                                  {req.logicgate_mapping && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LogicGate</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 10px', background: '#F5F3FF', borderRadius: 5 }}>{req.logicgate_mapping}</div>
                                    </div>
                                  )}
                                  {req.panorays_mapping && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#BE185D', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panorays</div>
                                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 10px', background: '#FDF2F8', borderRadius: 5 }}>{req.panorays_mapping}</div>
                                    </div>
                                  )}
                                  {req.assumptions && (
                                    <div style={{ fontSize: 11, color: AMBER }}><strong>Assumptions:</strong> {req.assumptions}</div>
                                  )}
                                  {req.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}><strong>Note:</strong> {req.notes}</div>}
                                </div>
                                <div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner</div>
                                    <select value={req.owner || 'Unknown'} onChange={(e) => updateMappingRow(req.requirement_id, { owner: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '5px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, background: WHITE }}>
                                      {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Draft RR Response</div>
                                    <textarea value={req.draft_rr_response || ''} onChange={(e) => updateMappingRow(req.requirement_id, { draft_rr_response: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      rows={4} placeholder="No RR-owned response drafted"
                                      style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                  </div>
                                  {(req.vendor_validation_required || req.vendor_question_or_prompt) && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor Prompt</div>
                                      <textarea value={req.vendor_question_or_prompt || ''} onChange={(e) => updateMappingRow(req.requirement_id, { vendor_question_or_prompt: e.target.value })} onClick={(e) => e.stopPropagation()}
                                        rows={2}
                                        style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select value={req.status || 'Draft'} onChange={(e) => updateMappingRow(req.requirement_id, { status: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, background: WHITE }}>
                                      {['Draft', 'In Review', 'Approved', 'Sent'].map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                    <button onClick={(e) => { e.stopPropagation(); regenerateRow(req) }} disabled={regeneratingRow === req.requirement_id}
                                      style={{ padding: '5px 12px', background: regeneratingRow === req.requirement_id ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 5, fontSize: 11, cursor: regeneratingRow === req.requirement_id ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                                      {regeneratingRow === req.requirement_id ? '…' : '↻ Regen'}
                                    </button>
                                  </div>
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
            </Card>

            {/* Pack summary */}
            {mappingSummary && (
              <Card style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pack Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    {Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Gaps & Risks</div>
                        {mappingSummary.gaps_and_risks.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                            <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(mappingSummary.assumptions) && mappingSummary.assumptions.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Assumptions</div>
                        {mappingSummary.assumptions.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 3 }}>• {item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    {Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Next Actions</div>
                        {mappingSummary.recommended_next_actions.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                            <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

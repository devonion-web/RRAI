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
    case 'RR':          return { bg: '#DBEAFE', text: '#1D4ED8' }
    case 'LogicGate':   return { bg: '#F3E8FF', text: '#7C3AED' }
    case 'Panorays':    return { bg: '#FCE7F3', text: '#BE185D' }
    case 'Joint':       return { bg: '#D1FAE5', text: '#065F46' }
    case 'Not Relevant': return { bg: '#F1F5F9', text: '#94A3B8' }
    default:            return { bg: '#F1F5F9', text: '#64748B' }
  }
}

function relevanceColour(r) {
  switch (r) {
    case 'Relevant':     return { bg: '#DCFCE7', text: '#15803D' }
    case 'Not Relevant': return { bg: '#F1F5F9', text: '#94A3B8' }
    default:             return { bg: '#FEF9C3', text: '#A16207' }
  }
}

function priorityColour(p) {
  switch (p) {
    case 'High':   return RED
    case 'Medium': return AMBER
    default:       return '#94A3B8'
  }
}

function responseTypeColour(rt) {
  switch (rt) {
    case 'Direct':             return { bg: '#DBEAFE', text: '#1D4ED8' }
    case 'Vendor Validation':  return { bg: '#F3E8FF', text: '#7C3AED' }
    case 'Collaborative':      return { bg: '#D1FAE5', text: '#065F46' }
    case 'Decline':            return { bg: '#F1F5F9', text: '#94A3B8' }
    default:                   return { bg: '#F1F5F9', text: '#64748B' }
  }
}

function pursuitColour(rec) {
  switch (rec) {
    case 'Proceed':         return { bg: '#DCFCE7', border: '#86EFAC', text: '#14532D' }
    case 'Do not pursue':   return { bg: '#FEE2E2', border: '#FCA5A5', text: '#7F1D1D' }
    default:                return { bg: '#FEF9C3', border: '#FDE047', text: '#713F12' }
  }
}

function docTypeColour(dt) {
  const map = {
    'Requirements Matrix':    { bg: '#DBEAFE', text: '#1D4ED8' },
    'RFP Overview':           { bg: '#D1FAE5', text: '#065F46' },
    'Scope Document':         { bg: '#F3E8FF', text: '#7C3AED' },
    'Evaluation Criteria':    { bg: '#FEF9C3', text: '#A16207' },
    'Procurement Instructions': { bg: '#E0F2FE', text: '#0369A1' },
    'Commercial Requirements': { bg: '#FCE7F3', text: '#BE185D' },
    'Security Requirements':  { bg: '#FEE2E2', text: '#991B1B' },
    'Supporting Material':    { bg: '#F1F5F9', text: '#475569' },
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

function tableCell(text, { bold = false } = {}) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold, color: '1E293B' })],
    })],
  })
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
  top:    { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left:   { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right:  { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}

// ── DOCX Export — RR Opportunity Response Assessment ──────────────────────────
async function exportAssessmentDocx({ assessment, requirements, rfpUnderstanding, company, vendorContext }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const a = assessment || {}
  const u = rfpUnderstanding || {}

  // Cover
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'RR Opportunity Response Assessment', font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
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

  // Pursuit Recommendation
  children.push(docHeaderBar('1. Pursuit Recommendation'))
  children.push(docSpacer())
  const p1 = docLabel('Recommendation', a.pursuit_recommendation)
  if (p1) children.push(p1)
  const p2 = docLabel('Rationale', a.pursuit_rationale)
  if (p2) children.push(p2)
  const p3 = docLabel('Response Confidence', a.response_confidence)
  if (p3) children.push(p3)
  children.push(docDivider())
  children.push(docSpacer())

  // Opportunity Summary
  children.push(docHeaderBar('2. Opportunity Summary'))
  children.push(docSpacer())
  const p4 = docLabel('Company / Prospect', company || 'Unknown')
  if (p4) children.push(p4)
  const p5 = docLabel('Industry', u.customer_name || u.industry)
  if (p5) children.push(p5)
  if (a.opportunity_summary) children.push(docBody(a.opportunity_summary))
  const p6 = docLabel('Timeline', u.timeline)
  if (p6) children.push(p6)
  const p7 = docLabel('Procurement Process', u.procurement_process)
  if (p7) children.push(p7)
  const p8 = docLabel('Scope', u.scope)
  if (p8) children.push(p8)
  children.push(docDivider())
  children.push(docSpacer())

  // Customer Objectives
  if (Array.isArray(a.customer_objectives) && a.customer_objectives.length) {
    children.push(docHeaderBar('3. Customer Objectives'))
    children.push(docSpacer())
    a.customer_objectives.forEach((o) => children.push(docBullet(String(o))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Key Themes
  if (Array.isArray(a.key_themes) && a.key_themes.length) {
    children.push(docHeaderBar('4. Key Themes'))
    children.push(docSpacer())
    a.key_themes.forEach((t) => children.push(docBullet(String(t))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // LogicGate Capability Mapping
  if (Array.isArray(a.logicgate_capability_mapping) && a.logicgate_capability_mapping.length) {
    children.push(docHeaderBar('5. LogicGate Capability Mapping'))
    children.push(docSpacer())
    a.logicgate_capability_mapping.forEach((t) => children.push(docBullet(String(t))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // RR Service Mapping
  if (Array.isArray(a.rr_service_mapping) && a.rr_service_mapping.length) {
    children.push(docHeaderBar('6. RR Service Mapping'))
    children.push(docSpacer())
    a.rr_service_mapping.forEach((t) => children.push(docBullet(String(t))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Recommended Strategy
  if (a.recommended_strategy) {
    children.push(docHeaderBar('7. Recommended Response Strategy'))
    children.push(docSpacer())
    children.push(docBody(a.recommended_strategy))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Risks & Assumptions
  const ras = a.risks_and_assumptions || {}
  if ((Array.isArray(ras.risks) && ras.risks.length) || (Array.isArray(ras.assumptions) && ras.assumptions.length)) {
    children.push(docHeaderBar('8. Risks and Assumptions'))
    children.push(docSpacer())
    if (Array.isArray(ras.risks) && ras.risks.length) {
      children.push(docSubBar('Risks'))
      ras.risks.forEach((r) => children.push(docBullet(String(r))))
      children.push(docSpacer())
    }
    if (Array.isArray(ras.assumptions) && ras.assumptions.length) {
      children.push(docSubBar('Assumptions'))
      ras.assumptions.forEach((a2) => children.push(docBullet(String(a2))))
    }
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Worklist — RR response items
  const relevant = (requirements || []).filter((r) => r.relevance !== 'Not Relevant')
  if (relevant.length) {
    children.push(docHeaderBar('9. RR Response Worklist'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Requirement', 'Owner', 'Response Type', 'Priority', 'Why It Matters'].map(tableCellH) })
    const rows = relevant.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.recommended_owner || '—'),
      tableCell(r.recommended_response_type || '—'),
      tableCell(r.priority || '—'),
      tableCell(r.why_it_matters || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
    children.push(docSpacer())
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Not Relevant
  const notRelevant = (requirements || []).filter((r) => r.relevance === 'Not Relevant')
  if (notRelevant.length) {
    children.push(docHeaderBar('10. Requirements Not Relevant'))
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
  saveAs(blob, `RR-Assessment-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── DOCX Export — 12-section RR Mapping Pack ──────────────────────────────────
async function exportMappingDocx({ assessment, mappingRows, mappingSummary, requirements, company, vendorContext }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const a = assessment || {}

  // Cover
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

  // Opportunity Summary
  children.push(docHeaderBar('2. Opportunity Summary'))
  children.push(docSpacer())
  const p1 = docLabel('Company / Prospect', company || 'Unknown')
  if (p1) children.push(p1)
  const p2 = docLabel('Pursuit Recommendation', a.pursuit_recommendation)
  if (p2) children.push(p2)
  if (a.opportunity_summary) children.push(docBody(a.opportunity_summary))
  children.push(docLabel('Total Requirements', String(mappingRows.length || (requirements && requirements.length) || '—')))
  children.push(docDivider())
  children.push(docSpacer())

  // Strategy
  if (a.recommended_strategy) {
    children.push(docHeaderBar('3. Recommended Response Strategy'))
    children.push(docSpacer())
    children.push(docBody(a.recommended_strategy))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Ownership Breakdown
  children.push(docHeaderBar('4. Ownership Breakdown'))
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

  // Requirement Mapping Matrix
  if (mappingRows.length) {
    children.push(docHeaderBar('5. Requirement Mapping Matrix'))
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

  // RR-Owned Draft Responses
  const rrOwned = mappingRows.filter((r) => r.owner === 'RR' && r.draft_rr_response)
  if (rrOwned.length) {
    children.push(docHeaderBar('6. RR-Owned Draft Responses'))
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

  // Vendor Validation Required
  const vendorItems = mappingRows.filter((r) => (r.owner === 'LogicGate' || r.owner === 'Panorays') && r.vendor_validation_required)
  if (vendorItems.length) {
    children.push(docHeaderBar('7. LogicGate / Panorays Validation Required'))
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

  // Joint Items
  const jointItems = mappingRows.filter((r) => r.owner === 'Joint')
  if (jointItems.length) {
    children.push(docHeaderBar('8. Joint Response Items'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'RR Response Element', 'Vendor Validation Needed'].map(tableCellH) })
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

  // Gaps, Risks and Assumptions
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
    }
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Commercial / Delivery
  if (mappingSummary && Array.isArray(mappingSummary.commercial_delivery_considerations) && mappingSummary.commercial_delivery_considerations.length) {
    children.push(docHeaderBar('10. Commercial / Delivery Considerations'))
    children.push(docSpacer())
    mappingSummary.commercial_delivery_considerations.forEach((item) => children.push(docBullet(String(item))))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Next Actions
  if (mappingSummary && Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length) {
    children.push(docHeaderBar('11. Recommended Next Actions'))
    children.push(docSpacer())
    mappingSummary.recommended_next_actions.forEach((item, i) => children.push(new Paragraph({
      spacing: { after: 80, line: 276 }, indent: { left: 120 },
      children: [
        new TextRun({ text: `${i + 1}.  `, bold: true, font: 'Calibri', size: 22, color: '0B1F3A' }),
        new TextRun({ text: clean(String(item)), font: 'Calibri', size: 22, color: '1E293B' }),
      ],
    })))
    children.push(docDivider())
    children.push(docSpacer())
  }

  // Appendix
  if (Array.isArray(requirements) && requirements.length) {
    children.push(docHeaderBar('12. Appendix: Assessed Requirements'))
    children.push(docSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Category', 'Relevance', 'Owner', 'Priority'].map(tableCellH) })
    const rows = requirements.map((r) => new TableRow({ children: [
      tableCell(r.requirement_id),
      tableCell(typeof r.original_question === 'string' ? r.original_question.slice(0, 200) : ''),
      tableCell(r.category), tableCell(r.relevance || '—'),
      tableCell(r.recommended_owner || '—'), tableCell(r.priority || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tblBorders, rows: [hdr, ...rows] }))
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

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function StatPill({ label, count, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px', background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, minWidth: 100 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || NAVY, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RFPModule() {
  // Inputs
  const [company, setCompany] = useState('')
  const [vendorContext, setVendorContext] = useState('LogicGate')
  const [documents, setDocuments] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('RFP Document')
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  // Assessment results
  const [assessment, setAssessment] = useState(null)
  const [rfpUnderstanding, setRfpUnderstanding] = useState(null)
  const [documentClassifications, setDocumentClassifications] = useState([])
  const [requirements, setRequirements] = useState([])  // enriched worklist

  // Mapping pack results
  const [mappingRows, setMappingRows] = useState([])
  const [mappingSummary, setMappingSummary] = useState(null)

  // UI state
  const [loading, setLoading] = useState(null)  // 'extract' | 'map' | null
  const [error, setError] = useState(null)

  // Worklist filters
  const [wlFilterRelevance, setWlFilterRelevance] = useState('All')
  const [wlFilterOwner, setWlFilterOwner] = useState('All')
  const [wlFilterPriority, setWlFilterPriority] = useState('All')
  const [wlFilterType, setWlFilterType] = useState('All')
  const [wlExpanded, setWlExpanded] = useState(null)

  // Mapping pack filters
  const [mapFilterOwner, setMapFilterOwner] = useState('All')
  const [mapFilterCategory, setMapFilterCategory] = useState('All')
  const [mapFilterConfidence, setMapFilterConfidence] = useState('All')
  const [mapExpanded, setMapExpanded] = useState(null)
  const [regeneratingRow, setRegeneratingRow] = useState(null)

  // Progress
  const [extractProgress, setExtractProgress] = useState(null)
  const [mapProgress, setMapProgress] = useState(null)
  const pollRef = useRef(null)
  const mapPollRef = useRef(null)

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (mapPollRef.current) clearInterval(mapPollRef.current)
  }, [])

  // Worklist filtered + counts
  const visibleWorklist = requirements.filter((r) => {
    if (wlFilterRelevance !== 'All' && r.relevance !== wlFilterRelevance) return false
    if (wlFilterOwner !== 'All' && r.recommended_owner !== wlFilterOwner) return false
    if (wlFilterPriority !== 'All' && r.priority !== wlFilterPriority) return false
    if (wlFilterType !== 'All' && r.recommended_response_type !== wlFilterType) return false
    return true
  })

  const wlCounts = {
    relevant: requirements.filter((r) => r.relevance === 'Relevant').length,
    uncertain: requirements.filter((r) => r.relevance === 'Uncertain').length,
    notRelevant: requirements.filter((r) => r.relevance === 'Not Relevant').length,
    high: requirements.filter((r) => r.priority === 'High').length,
    vendorValidation: requirements.filter((r) => r.recommended_response_type === 'Vendor Validation').length,
  }

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

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getDocClassification(docId) {
    return documentClassifications.find((c) => c.id === docId)?.docType || null
  }

  async function addPastedDoc() {
    if (!pasteText.trim()) return
    setUploading(true); setError(null)
    try {
      const meta = await rfpStoreText({ name: pasteName || 'RFP Document', text: pasteText.trim() })
      setDocuments((prev) => [...prev, { id: meta.id, name: meta.name, charCount: meta.charCount }])
      setPasteText(''); setPasteName('RFP Document')
    } catch (e) { setError('Failed to store document: ' + e.message) }
    finally { setUploading(false) }
  }

  async function handleFiles(files) {
    if (!files.length) return
    setUploading(true); setError(null)
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
        id: f.id, name: f.name, fileType: f.fileType, charCount: f.charCount, rowCount: f.rowCount,
      }))])
      if (bad.length) setError(`Could not extract text from: ${bad.map((f) => f.name).join(', ')}`)
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  function handleDrop(e) { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files; if (f && f.length) handleFiles(Array.from(f)) }
  function handleDragOver(e) { e.preventDefault(); e.stopPropagation() }

  // ── Step 1: Assess ────────────────────────────────────────────────────────
  async function runAssess() {
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
            setError(job.error || 'Assessment failed')
            setLoading(null); setExtractProgress(null)
          }
        } catch { /* network hiccup — keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setExtractProgress(null) }
  }

  // ── Step 2: Generate Mapping Pack ─────────────────────────────────────────
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
            setError(job.error || 'Mapping pack generation failed')
            setLoading(null); setMapProgress(null)
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setMapProgress(null) }
  }

  function updateMappingRow(requirementId, updates) {
    setMappingRows((prev) => prev.map((r) => r.requirement_id === requirementId ? { ...r, ...updates } : r))
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
          why_it_matters: req.why_it_matters,
          recommended_owner: req.recommended_owner,
          logicgate_mapping: req.logicgate_mapping,
          rr_mapping: req.rr_mapping,
          priority: req.priority,
          linked_objectives: req.linked_objectives,
        },
        vendorContext, company, rfpUnderstanding,
      })
      if (row) updateMappingRow(req.requirement_id, row)
    } catch (e) { setError('Regenerate failed: ' + e.message) }
    finally { setRegeneratingRow(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const hasAssessment = !!assessment
  const hasMappingPack = mappingRows.length > 0
  const pursuitCol = pursuitColour(assessment?.pursuit_recommendation)
  const ras = assessment?.risks_and_assumptions || {}

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ background: NAVY, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: WHITE }}>RFP / RFI Response Manager</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Assess · Triage · Map · Validate · Export</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasAssessment && (
            <button
              onClick={() => exportAssessmentDocx({ assessment, requirements, rfpUnderstanding, company, vendorContext }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: WHITE, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Assessment
            </button>
          )}
          {hasMappingPack && (
            <button
              onClick={() => exportMappingDocx({ assessment, mappingRows, mappingSummary, requirements, company, vendorContext }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: WHITE, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Mapping Pack
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── Setup card ── */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Company / Prospect</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp"
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Vendor Context</label>
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
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Document name</label>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="e.g. Acme RFP Section 3"
                  style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={addPastedDoc} disabled={!pasteText.trim()}
                style={{ background: pasteText.trim() ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                + Add document
              </button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste RFP or RFI content here — copy from Word, PDF, email, or any source…"
              rows={4}
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          {/* File upload zone */}
          <div onDrop={handleDrop} onDragOver={handleDragOver}
            style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px', marginBottom: documents.length ? 12 : 0, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 12 }}>
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
              {documents.map((d) => {
                const classification = getDocClassification(d.id)
                const classColour = classification ? docTypeColour(classification) : null
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: BLUE_LIGHT, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>
                    <span style={{ fontSize: 13 }}>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                    <span>{d.name}</span>
                    {classification && (
                      <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: classColour.bg, color: classColour.text }}>
                        {classification}
                      </span>
                    )}
                    {d.fileType === 'excel' && d.rowCount
                      ? <span style={{ color: MUTED, fontSize: 11 }}>({d.rowCount} rows)</span>
                      : d.charCount ? <span style={{ color: MUTED, fontSize: 11 }}>({Math.round(d.charCount / 1000)}k chars)</span> : null}
                    <button onClick={() => { rfpRemoveDocument(d.id); setDocuments((prev) => prev.filter((x) => x.id !== d.id)) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress */}
          {loading === 'extract' && extractProgress && <div style={{ marginTop: 12 }}><ProgressBar progress={extractProgress} color={NAVY} /></div>}
          {loading === 'map' && mapProgress && <div style={{ marginTop: 12 }}><ProgressBar progress={mapProgress} color='#059669' /></div>}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button onClick={runAssess} disabled={!documents.length || !!loading}
              style={{ background: documents.length && !loading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed' }}>
              {loading === 'extract' ? 'Assessing…' : '1. Assess Opportunity'}
            </button>

            {requirements.length > 0 && (
              <button onClick={runMappingPack} disabled={!!loading}
                style={{ background: !loading ? '#059669' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'map' ? 'Generating…' : `2. Generate RR Mapping Pack (${requirements.filter((r) => r.relevance !== 'Not Relevant').length} relevant requirements)`}
              </button>
            )}
          </div>

          {loading && !extractProgress && !mapProgress && <div style={{ marginTop: 12 }}><Spinner /></div>}
          {error && <div style={{ marginTop: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
        </Card>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ASSESSMENT REPORT                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {hasAssessment && (
          <>
            {/* ── Pursuit Recommendation banner ── */}
            <div style={{ background: pursuitCol.bg, border: `1px solid ${pursuitCol.border}`, borderRadius: 8, padding: '20px 28px', marginBottom: 20, display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: pursuitCol.text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Pursuit Recommendation</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: pursuitCol.text }}>{assessment.pursuit_recommendation || '—'}</div>
                {assessment.response_confidence && (
                  <div style={{ marginTop: 6, fontSize: 12, color: pursuitCol.text, opacity: 0.8 }}>
                    Response confidence: <strong>{assessment.response_confidence}</strong>
                  </div>
                )}
              </div>
              {assessment.pursuit_rationale && (
                <div style={{ flex: 1, borderLeft: `2px solid ${pursuitCol.border}`, paddingLeft: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: pursuitCol.text, marginBottom: 4 }}>Rationale</div>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>{assessment.pursuit_rationale}</div>
                </div>
              )}
            </div>

            {/* ── Opportunity Summary ── */}
            {assessment.opportunity_summary && (
              <Card style={{ marginBottom: 20 }}>
                <SectionLabel>Opportunity Summary</SectionLabel>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{assessment.opportunity_summary}</div>
              </Card>
            )}

            {/* ── Customer Objectives + Key Themes ── */}
            {(Array.isArray(assessment.customer_objectives) || Array.isArray(assessment.key_themes)) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Card>
                  <SectionLabel>Customer Objectives</SectionLabel>
                  {(assessment.customer_objectives || []).map((o, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: GREEN, marginTop: 1, flexShrink: 0 }}>✓</span> {o}
                    </div>
                  ))}
                  {(!assessment.customer_objectives || assessment.customer_objectives.length === 0) && (
                    <div style={{ fontSize: 12, color: MUTED }}>None identified from documents</div>
                  )}
                </Card>
                <Card>
                  <SectionLabel>Key Themes</SectionLabel>
                  {(assessment.key_themes || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: NAVY, marginTop: 1, flexShrink: 0 }}>◆</span> {t}
                    </div>
                  ))}
                  {(!assessment.key_themes || assessment.key_themes.length === 0) && (
                    <div style={{ fontSize: 12, color: MUTED }}>None identified from documents</div>
                  )}
                </Card>
              </div>
            )}

            {/* ── LogicGate + RR Service Mapping ── */}
            {(Array.isArray(assessment.logicgate_capability_mapping) || Array.isArray(assessment.rr_service_mapping)) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Card>
                  <SectionLabel>LogicGate Capability Mapping</SectionLabel>
                  {(assessment.logicgate_capability_mapping || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: '#7C3AED', marginTop: 1, flexShrink: 0 }}>▸</span> {t}
                    </div>
                  ))}
                  {(!assessment.logicgate_capability_mapping || assessment.logicgate_capability_mapping.length === 0) && (
                    <div style={{ fontSize: 12, color: MUTED }}>Not available</div>
                  )}
                </Card>
                <Card>
                  <SectionLabel>RR Service Mapping</SectionLabel>
                  {(assessment.rr_service_mapping || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: '#1D4ED8', marginTop: 1, flexShrink: 0 }}>▸</span> {t}
                    </div>
                  ))}
                  {(!assessment.rr_service_mapping || assessment.rr_service_mapping.length === 0) && (
                    <div style={{ fontSize: 12, color: MUTED }}>Not available</div>
                  )}
                </Card>
              </div>
            )}

            {/* ── Recommended Strategy ── */}
            {assessment.recommended_strategy && (
              <Card style={{ marginBottom: 20, borderLeft: `4px solid ${NAVY}` }}>
                <SectionLabel>Recommended Response Strategy</SectionLabel>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{assessment.recommended_strategy}</div>
              </Card>
            )}

            {/* ── Risks & Assumptions ── */}
            {((Array.isArray(ras.risks) && ras.risks.length) || (Array.isArray(ras.assumptions) && ras.assumptions.length)) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <Card>
                  <SectionLabel>Risks</SectionLabel>
                  {(ras.risks || []).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {r}
                    </div>
                  ))}
                </Card>
                <Card>
                  <SectionLabel>Assumptions</SectionLabel>
                  {(ras.assumptions || []).map((a2, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: MUTED, flexShrink: 0 }}>•</span> {a2}
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* WORKLIST                                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {requirements.length > 0 && (
              <>
                {/* Stats bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
                    RR Response Worklist — {requirements.length} requirements assessed
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatPill label="Relevant" count={wlCounts.relevant} color={GREEN} />
                    <StatPill label="Uncertain" count={wlCounts.uncertain} color={AMBER} />
                    <StatPill label="Not Relevant" count={wlCounts.notRelevant} color={MUTED} />
                    <StatPill label="High Priority" count={wlCounts.high} color={RED} />
                    <StatPill label="Vendor Validation" count={wlCounts.vendorValidation} color='#7C3AED' />
                  </div>
                </div>

                {/* Worklist filter bar */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  {/* Relevance pills */}
                  {['All', 'Relevant', 'Uncertain', 'Not Relevant'].map((v) => {
                    const count = v === 'All' ? requirements.length
                      : v === 'Relevant' ? wlCounts.relevant
                      : v === 'Uncertain' ? wlCounts.uncertain : wlCounts.notRelevant
                    const col = v === 'All' ? { bg: NAVY, text: WHITE } : relevanceColour(v)
                    const active = wlFilterRelevance === v
                    return (
                      <button key={v} onClick={() => setWlFilterRelevance(v)}
                        style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? (v === 'All' ? NAVY : col.text) : BORDER}`, background: active ? (v === 'All' ? NAVY : col.bg) : WHITE, color: active ? (v === 'All' ? WHITE : col.text) : MUTED }}>
                        {v} ({count})
                      </button>
                    )
                  })}

                  <select value={wlFilterOwner} onChange={(e) => setWlFilterOwner(e.target.value)}
                    style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, marginLeft: 8 }}>
                    <option value="All">All owners</option>
                    {['RR', 'LogicGate', 'Panorays', 'Joint', 'Not Relevant', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                  </select>

                  <select value={wlFilterPriority} onChange={(e) => setWlFilterPriority(e.target.value)}
                    style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                    <option value="All">All priorities</option>
                    {['High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
                  </select>

                  <select value={wlFilterType} onChange={(e) => setWlFilterType(e.target.value)}
                    style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                    <option value="All">All response types</option>
                    {['Direct', 'Vendor Validation', 'Collaborative', 'Decline'].map((t) => <option key={t}>{t}</option>)}
                  </select>

                  {(wlFilterRelevance !== 'All' || wlFilterOwner !== 'All' || wlFilterPriority !== 'All' || wlFilterType !== 'All') && (
                    <button onClick={() => { setWlFilterRelevance('All'); setWlFilterOwner('All'); setWlFilterPriority('All'); setWlFilterType('All') }}
                      style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Clear filters
                    </button>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{visibleWorklist.length} / {requirements.length} requirements</span>
                </div>

                {/* Worklist table */}
                <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: NAVY, color: WHITE }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Ref</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Requirement</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Relevance</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Owner</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Response Type</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600 }}>Priority</th>
                          <th style={{ padding: '10px 12px', width: 28 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleWorklist.map((req, i) => (
                          <React.Fragment key={req.requirement_id || i}>
                            <tr onClick={() => setWlExpanded(wlExpanded === req.requirement_id ? null : req.requirement_id)}
                              style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                              <td style={{ padding: '9px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{req.requirement_id}</td>
                              <td style={{ padding: '9px 12px', maxWidth: 360 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>{req.original_question}</div>
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                <Badge label={req.relevance || 'Uncertain'} colour={relevanceColour(req.relevance)} />
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                <Badge label={req.recommended_owner || '—'} colour={ownerColour(req.recommended_owner)} />
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                {req.recommended_response_type
                                  ? <Badge label={req.recommended_response_type} colour={responseTypeColour(req.recommended_response_type)} />
                                  : <span style={{ color: MUTED }}>—</span>}
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColour(req.priority), flexShrink: 0 }} />
                                  <span style={{ color: TEXT }}>{req.priority || '—'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center', color: MUTED, fontSize: 10 }}>
                                {wlExpanded === req.requirement_id ? '▲' : '▼'}
                              </td>
                            </tr>

                            {/* Expanded row */}
                            {wlExpanded === req.requirement_id && (
                              <tr style={{ background: BLUE_LIGHT }}>
                                <td colSpan={7} style={{ padding: '20px 24px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                    {/* Left */}
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Requirement</div>
                                      <div style={{ fontSize: 13, color: TEXT, marginBottom: 16, lineHeight: 1.6, padding: '10px 14px', background: WHITE, borderRadius: 6, border: `1px solid ${BORDER}` }}>{req.original_question}</div>

                                      {req.why_it_matters && (
                                        <div style={{ marginBottom: 12 }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: AMBER, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Why It Matters</div>
                                          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{req.why_it_matters}</div>
                                        </div>
                                      )}

                                      {Array.isArray(req.linked_objectives) && req.linked_objectives.length > 0 && (
                                        <div style={{ marginBottom: 12 }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Linked Objectives</div>
                                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {req.linked_objectives.map((o, j) => (
                                              <span key={j} style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, background: '#D1FAE5', color: '#065F46', fontWeight: 500 }}>{o}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {req.notes && (
                                        <div style={{ fontSize: 11, color: MUTED }}><strong>Note:</strong> {req.notes}</div>
                                      )}
                                    </div>

                                    {/* Right */}
                                    <div>
                                      {req.logicgate_mapping && (
                                        <div style={{ marginBottom: 14 }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LogicGate Mapping</div>
                                          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#F5F3FF', borderRadius: 6 }}>{req.logicgate_mapping}</div>
                                        </div>
                                      )}
                                      {req.rr_mapping && (
                                        <div style={{ marginBottom: 14 }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>RR Mapping</div>
                                          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, padding: '8px 12px', background: '#EFF6FF', borderRadius: 6 }}>{req.rr_mapping}</div>
                                        </div>
                                      )}

                                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                                        <div>
                                          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Category</div>
                                          <div style={{ fontSize: 12, color: TEXT }}>{req.category || '—'}</div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Mandatory</div>
                                          <div style={{ fontSize: 12, color: TEXT }}>{req.mandatory_optional || '—'}</div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Source</div>
                                          <div style={{ fontSize: 12, color: TEXT }}>{req.source_document || '—'}</div>
                                        </div>
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
                    {visibleWorklist.length === 0 && (
                      <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                        No requirements match the selected filters.
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MAPPING PACK RESULTS                                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {hasMappingPack && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
              RR Mapping Pack — {mappingRows.length} requirements mapped
            </div>

            {/* Mapping filter bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
                  style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, marginLeft: 8 }}>
                  <option value="All">All categories</option>
                  {mapCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}

              <select value={mapFilterConfidence} onChange={(e) => setMapFilterConfidence(e.target.value)}
                style={{ padding: '4px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}>
                <option value="All">All confidence</option>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>

              {(mapFilterOwner !== 'All' || mapFilterCategory !== 'All' || mapFilterConfidence !== 'All') && (
                <button onClick={() => { setMapFilterOwner('All'); setMapFilterCategory('All'); setMapFilterConfidence('All') }}
                  style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear filters
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{visibleMapping.length} / {mappingRows.length}</span>
            </div>

            {/* Mapping table */}
            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
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
                    {visibleMapping.map((req, i) => (
                      <React.Fragment key={req.requirement_id || i}>
                        <tr onClick={() => setMapExpanded(mapExpanded === req.requirement_id ? null : req.requirement_id)}
                          style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{req.requirement_id}</td>
                          <td style={{ padding: '9px 12px', maxWidth: 340 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT }}>{req.original_question}</div>
                          </td>
                          <td style={{ padding: '9px 12px', color: MUTED, whiteSpace: 'nowrap', fontSize: 11 }}>{req.category}</td>
                          <td style={{ padding: '9px 12px' }}>
                            {req.owner ? <Badge label={req.owner} colour={ownerColour(req.owner)} /> : <span style={{ color: BORDER }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ color: req.confidence === 'High' ? GREEN : req.confidence === 'Medium' ? AMBER : RED, fontWeight: 600, fontSize: 11 }}>{req.confidence || '—'}</span>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            {req.vendor_validation_required
                              ? <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: 11 }}>Yes</span>
                              : <span style={{ color: MUTED, fontSize: 11 }}>No</span>}
                          </td>
                          <td style={{ padding: '9px 12px', color: MUTED, fontSize: 11 }}>{req.status || 'Draft'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: MUTED, fontSize: 10 }}>
                            {mapExpanded === req.requirement_id ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Expanded mapping row */}
                        {mapExpanded === req.requirement_id && (
                          <tr style={{ background: BLUE_LIGHT }}>
                            <td colSpan={8} style={{ padding: '20px 24px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                {/* Left — mappings */}
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
                                  {req.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}><strong>Note:</strong> {req.notes}</div>}
                                </div>

                                {/* Right — editable */}
                                <div>
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owner</div>
                                    <select value={req.owner || 'Unknown'} onChange={(e) => updateMappingRow(req.requirement_id, { owner: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: WHITE }}>
                                      {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                  </div>

                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft RR Response</div>
                                    <textarea value={req.draft_rr_response || ''} onChange={(e) => updateMappingRow(req.requirement_id, { draft_rr_response: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      rows={5} placeholder="No RR-owned response drafted"
                                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                  </div>

                                  {(req.vendor_validation_required || req.vendor_question_or_prompt) && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor Validation Prompt</div>
                                      <textarea value={req.vendor_question_or_prompt || ''} onChange={(e) => updateMappingRow(req.requirement_id, { vendor_question_or_prompt: e.target.value })} onClick={(e) => e.stopPropagation()}
                                        rows={3}
                                        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                                    <select value={req.status || 'Draft'} onChange={(e) => updateMappingRow(req.requirement_id, { status: e.target.value })} onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: WHITE }}>
                                      {['Draft', 'In Review', 'Approved', 'Sent'].map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); regenerateRow(req) }}
                                      disabled={regeneratingRow === req.requirement_id}
                                      style={{ padding: '5px 12px', background: regeneratingRow === req.requirement_id ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, fontSize: 12, cursor: regeneratingRow === req.requirement_id ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                                      {regeneratingRow === req.requirement_id ? 'Regenerating…' : '↻ Regenerate'}
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
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 16 }}>Pack Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    {Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <SectionLabel>Gaps & Risks</SectionLabel>
                        {mappingSummary.gaps_and_risks.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                            <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(mappingSummary.assumptions) && mappingSummary.assumptions.length > 0 && (
                      <div>
                        <SectionLabel>Assumptions</SectionLabel>
                        {mappingSummary.assumptions.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>• {item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    {Array.isArray(mappingSummary.commercial_delivery_considerations) && mappingSummary.commercial_delivery_considerations.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <SectionLabel>Commercial & Delivery</SectionLabel>
                        {mappingSummary.commercial_delivery_considerations.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>• {item}</div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length > 0 && (
                      <div>
                        <SectionLabel>Recommended Next Actions</SectionLabel>
                        {mappingSummary.recommended_next_actions.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
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

import React, { useState, useRef } from 'react'
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

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = '#0B1F3A'
const BLUE   = '#1D4ED8'
const GREEN  = '#16A34A'
const AMBER  = '#D97706'
const RED    = '#DC2626'
const PURPLE = '#7C3AED'
const TEAL   = '#0D9488'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const WHITE  = '#FFFFFF'
const BG     = '#F8FAFC'
const LBLUE  = '#EAF1F8'

// ── Helpers ───────────────────────────────────────────────────────────────────
function ownerColor(owner) {
  switch (owner) {
    case 'RR':           return { bg: '#DBEAFE', text: BLUE }
    case 'LogicGate':    return { bg: '#F3E8FF', text: PURPLE }
    case 'Panorays':     return { bg: '#FCE7F3', text: '#BE185D' }
    case 'Joint':        return { bg: '#D1FAE5', text: '#065F46' }
    case 'Ignore':       return { bg: '#F1F5F9', text: '#94A3B8' }
    default:             return { bg: '#F1F5F9', text: MUTED }
  }
}

function bucketColor(b) {
  switch (b) {
    case 'RR':        return { bg: '#DBEAFE', text: BLUE }
    case 'LogicGate': return { bg: '#F3E8FF', text: PURPLE }
    case 'Joint':     return { bg: '#D1FAE5', text: '#065F46' }
    case 'Ignore':    return { bg: '#F1F5F9', text: MUTED }
    default:          return { bg: '#FEF9C3', text: AMBER }
  }
}

function docTypeColor(dt) {
  const m = {
    'Requirements Matrix':      { bg: '#DBEAFE', text: BLUE },
    'RFP Overview':             { bg: '#D1FAE5', text: '#065F46' },
    'Scope Document':           { bg: '#F3E8FF', text: PURPLE },
    'Evaluation Criteria':      { bg: '#FEF9C3', text: AMBER },
    'Procurement Instructions': { bg: '#E0F2FE', text: '#0369A1' },
    'Commercial Requirements':  { bg: '#FCE7F3', text: '#BE185D' },
    'Security Requirements':    { bg: '#FEE2E2', text: '#991B1B' },
    'Supporting Material':      { bg: '#F1F5F9', text: '#475569' },
  }
  return m[dt] || { bg: '#F1F5F9', text: MUTED }
}

function riskColor(cat) {
  switch (cat) {
    case 'delivery':    return { accent: RED,    bg: '#FEF2F2' }
    case 'integration': return { accent: AMBER,  bg: '#FFFBEB' }
    case 'resource':    return { accent: PURPLE, bg: '#FAF5FF' }
    case 'platform':    return { accent: TEAL,   bg: '#F0FDFA' }
    default:            return { accent: MUTED,  bg: BG }
  }
}

// ── Small components ──────────────────────────────────────────────────────────
function Badge({ label, color, size = 'sm' }) {
  const p = size === 'xs' ? '1px 6px' : '2px 9px'
  const fs = size === 'xs' ? 10 : 11
  return (
    <span style={{ display: 'inline-block', padding: p, borderRadius: 12, fontSize: fs, fontWeight: 600, background: color.bg, color: color.text, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SectionCard({ title, icon, children, accent = NAVY, style }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', ...style }}>
      <div style={{ padding: '10px 16px', background: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: WHITE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function BulletList({ items, color = NAVY, emptyText = '—' }) {
  if (!items || !items.length) return <span style={{ color: MUTED, fontSize: 12 }}>{emptyText}</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>
          <span style={{ color, flexShrink: 0, fontSize: 10, marginTop: 3 }}>▸</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function QList({ items, color, emptyText = '—' }) {
  if (!items || !items.length) return <span style={{ color: MUTED, fontSize: 12 }}>{emptyText}</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((q, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color, flexShrink: 0, fontSize: 11 }}>Q{i + 1}</span>
          <span>{q}</span>
        </div>
      ))}
    </div>
  )
}

function SubSection({ title, children, color = MUTED }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function ProgressBar({ progress }) {
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 5
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{progress.stage}</span>
        <span style={{ fontSize: 11, color: MUTED }}>{progress.done}/{progress.total}</span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: NAVY, borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s ease', minWidth: 8 }} />
      </div>
    </div>
  )
}

// ── DOCX helpers ──────────────────────────────────────────────────────────────
function clean(t) { return t ? String(t).replace(/\n/g, ' ').trim() : '' }

function dH(text) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A' },
    children: [new TextRun({ text: `  ${clean(text)}`, bold: true, color: 'FFFFFF', font: 'Calibri', size: 24 })],
  })
}
function dSub(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: 'EAF1F8' },
    children: [new TextRun({ text: `  ${clean(text)}`, bold: true, color: '0B1F3A', font: 'Calibri', size: 22 })],
  })
}
function dBody(text) {
  return new Paragraph({
    spacing: { after: 80, line: 276 }, indent: { left: 120 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}
function dBullet(text) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { after: 60, line: 260 }, indent: { left: 360, hanging: 240 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}
function dSpacer() { return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 60, after: 60 } }) }
function dDivider() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: '', font: 'Calibri', size: 4 })],
    border: { bottom: { style: 'single', size: 4, color: 'E2E8F0', space: 1 } },
  })
}
function tblH(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, bold: true, color: 'FFFFFF' })] })],
  })
}
function tblC(text) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: clean(String(text ?? '')), font: 'Calibri', size: 20, color: '1E293B' })] })],
  })
}
const TBORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}

async function exportOIDocx({ oi, requirements, company }) {
  const a = oi || {}
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const children = []

  // Cover
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE, spacing: { after: 200 },
    children: [new TextRun({ text: 'Opportunity Intelligence Assessment', font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: company || 'Unknown Prospect', font: 'Calibri', size: 36, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `Prepared by Risk Rising  ·  ${today}`, font: 'Calibri', size: 24, color: '64748B' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'INTERNAL — NOT FOR CUSTOMER DISTRIBUTION', font: 'Calibri', size: 20, bold: true, color: 'DC2626' })],
  }))
  children.push(dDivider())
  children.push(dSpacer())

  const pushList = (items, label) => {
    if (!items?.length) return
    children.push(dSub(label))
    items.forEach((item) => children.push(dBullet(typeof item === 'string' ? item : JSON.stringify(item))))
    children.push(dSpacer())
  }

  // Objectives
  children.push(dH('1. Customer Objectives'))
  children.push(dSpacer())
  pushList(a.customer_objectives, '')
  children.push(dDivider())

  // Use cases
  children.push(dH('2. Business Use Cases'))
  children.push(dSpacer())
  pushList(a.business_use_cases, '')
  children.push(dDivider())

  // Capabilities
  if (Array.isArray(a.capability_requirements) && a.capability_requirements.length) {
    children.push(dH('3. Capability Requirements'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Capability', 'RR/LG Area'].map(tblH) })
    const rows = a.capability_requirements.map((r) => new TableRow({ children: [tblC(r.capability), tblC(r.rr_area)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
    children.push(dDivider())
  }

  // LG Mapping
  if (Array.isArray(a.logicgate_mapping) && a.logicgate_mapping.length) {
    children.push(dH('4. LogicGate Module Mapping'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Requirement Area', 'LogicGate Module'].map(tblH) })
    const rows = a.logicgate_mapping.map((r) => new TableRow({ children: [tblC(r.requirement_area), tblC(r.logicgate_module)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
    children.push(dDivider())
  }

  // Scope
  const scope = a.scope_assessment || {}
  children.push(dH('5. Scope Assessment'))
  children.push(dSpacer())
  pushList(scope.in_scope, 'In Scope')
  pushList(scope.mandatory_items, 'Mandatory')
  pushList(scope.likely_out_of_scope, 'Likely Out of Scope')
  pushList(scope.optional_items, 'Optional / Phase 2')
  children.push(dDivider())

  // Delivery phases
  if (Array.isArray(a.suggested_delivery_phases) && a.suggested_delivery_phases.length) {
    children.push(dH('6. Suggested Delivery Phases'))
    children.push(dSpacer())
    a.suggested_delivery_phases.forEach((ph) => {
      children.push(dSub(`Phase ${ph.phase}: ${ph.name}`))
      ;(ph.items || []).forEach((item) => children.push(dBullet(item)))
      children.push(dSpacer())
    })
    children.push(dDivider())
  }

  // Resources
  if (Array.isArray(a.resource_assessment) && a.resource_assessment.length) {
    children.push(dH('7. Resource Assessment'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Role', 'Justification'].map(tblH) })
    const rows = a.resource_assessment.map((r) => new TableRow({ children: [tblC(r.role), tblC(r.justification)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
    children.push(dDivider())
  }

  // Integration
  const integ = a.integration_assessment || {}
  children.push(dH('8. Integration Assessment'))
  children.push(dSpacer())
  pushList(integ.likely_integrations, 'Likely Integrations')
  pushList(integ.data_sources, 'Data Sources')
  pushList(integ.api_dependencies, 'API Dependencies')
  children.push(dDivider())

  // Migration
  const mig = a.data_migration_assessment || {}
  children.push(dH('9. Data Migration Assessment'))
  children.push(dSpacer())
  children.push(dBody(`Complexity: ${mig.complexity || 'Unknown'}`))
  pushList(mig.likely_requirements, 'Likely Requirements')
  pushList(mig.assumptions, 'Assumptions')
  children.push(dDivider())

  // Support
  const sup = a.support_assessment || {}
  children.push(dH('10. Support Assessment'))
  children.push(dSpacer())
  pushList(sup.support_expectations, 'Support Expectations')
  pushList(sup.hypercare_requirements, 'Hypercare Requirements')
  pushList(sup.training_obligations, 'Training Obligations')
  children.push(dDivider())

  // Geo
  const geo = a.geographic_assessment || {}
  children.push(dH('11. Geographic & Timezone Assessment'))
  children.push(dSpacer())
  pushList(geo.operating_regions, 'Operating Regions')
  pushList(geo.implementation_timezone_impacts, 'Implementation Timezone')
  pushList(geo.support_timezone_impacts, 'Support Timezone')
  children.push(dDivider())

  // Risks
  const risk = a.risk_assessment || {}
  children.push(dH('12. Risk Assessment'))
  children.push(dSpacer())
  pushList(risk.delivery_risks, 'Delivery Risks')
  pushList(risk.integration_risks, 'Integration Risks')
  pushList(risk.resource_risks, 'Resource Risks')
  pushList(risk.platform_risks, 'Platform Risks')
  children.push(dDivider())

  // Open Questions
  const oq = a.open_questions || {}
  children.push(dH('13. Open Questions'))
  children.push(dSpacer())
  pushList(oq.customer_clarification, 'Customer Clarification')
  pushList(oq.vendor_clarification, 'Vendor Clarification')
  pushList(oq.scope_clarification, 'Scope Clarification')
  children.push(dDivider())

  // Response candidates (high-level)
  const rc = a.response_candidates || {}
  children.push(dH('14. Response Candidates'))
  children.push(dSpacer())
  pushList(rc.rr_responds, 'RR Responds')
  pushList(rc.logicgate_validates, 'LogicGate Validates')
  pushList(rc.joint_response, 'Joint Response')
  pushList(rc.can_be_ignored, 'Can Be Ignored')
  children.push(dDivider())

  // Per-requirement candidates
  if (requirements?.length) {
    children.push(dH('Response Candidates — Detail'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Requirement', 'Bucket', 'M/O', 'Reason'].map(tblH) })
    const rows = requirements.map((r) => new TableRow({ children: [
      tblC(r.requirement_id),
      tblC(typeof r.original_question === 'string' ? r.original_question.slice(0, 180) : ''),
      tblC(r.bucket),
      tblC(r.mandatory_optional),
      tblC(r.reason),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-OI-Assessment-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

async function exportMappingDocx({ oi, mappingRows, mappingSummary, company }) {
  const children = []
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const a = oi || {}

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE, spacing: { after: 200 },
    children: [new TextRun({ text: 'RFP / RFI Response Mapping Pack', font: 'Calibri', size: 52, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: company || 'Unknown Prospect', font: 'Calibri', size: 36, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `Prepared by Risk Rising  ·  ${today}`, font: 'Calibri', size: 24, color: '64748B' })],
  }))
  children.push(dDivider())
  children.push(dSpacer())

  if (Array.isArray(a.customer_objectives) && a.customer_objectives.length) {
    children.push(dH('Customer Objectives'))
    children.push(dSpacer())
    a.customer_objectives.forEach((o) => children.push(dBullet(String(o))))
    children.push(dSpacer())
    children.push(dDivider())
  }

  if (mappingRows.length) {
    children.push(dH('Response Mapping Matrix'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Requirement', 'Owner', 'Conf.', 'Vendor?'].map(tblH) })
    const rows = mappingRows.map((r) => new TableRow({ children: [
      tblC(r.requirement_id), tblC(typeof r.original_question === 'string' ? r.original_question.slice(0, 180) : ''),
      tblC(r.owner), tblC(r.confidence), tblC(r.vendor_validation_required ? 'Yes' : 'No'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
    children.push(dDivider())
  }

  const rrOwned = mappingRows.filter((r) => r.owner === 'RR' && r.draft_rr_response)
  if (rrOwned.length) {
    children.push(dH('RR-Owned Draft Responses'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Draft RR Response', 'Assumptions'].map(tblH) })
    const rows = rrOwned.map((r) => new TableRow({ children: [
      tblC(r.requirement_id), tblC(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tblC(r.draft_rr_response), tblC(r.assumptions || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
    children.push(dDivider())
  }

  if (mappingSummary) {
    children.push(dH('Pack Summary'))
    children.push(dSpacer())
    ;['gaps_and_risks', 'assumptions', 'commercial_delivery_considerations', 'recommended_next_actions'].forEach((k) => {
      const items = mappingSummary[k]
      if (Array.isArray(items) && items.length) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        children.push(dSub(label))
        items.forEach((item) => children.push(dBullet(String(item))))
        children.push(dSpacer())
      }
    })
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Mapping-Pack-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── OI Section Components ─────────────────────────────────────────────────────
function OISection({ number, title, icon, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: WHITE, background: NAVY, padding: '2px 6px', borderRadius: 4, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{number}</span>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: MUTED }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px' }}>{children}</div>}
    </div>
  )
}

function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
}

function MiniTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${BORDER}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '7px 10px', color: '#1E293B', lineHeight: 1.4, verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={headers.length} style={{ padding: '12px', color: MUTED, textAlign: 'center', fontSize: 12 }}>—</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ChipGrid({ items, colorFn }) {
  if (!items || !items.length) return <span style={{ fontSize: 12, color: MUTED }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item, i) => {
        const label = typeof item === 'string' ? item : (item.use_case || JSON.stringify(item))
        const c = colorFn ? colorFn(item) : { bg: LBLUE, text: NAVY }
        return <span key={i} style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, fontWeight: 500, background: c.bg, color: c.text }}>{label}</span>
      })}
    </div>
  )
}

function PhaseCard({ phase }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', background: LBLUE, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: WHITE, background: NAVY, padding: '1px 7px', borderRadius: 10 }}>Phase {phase.phase}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{phase.name}</span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <BulletList items={phase.items} />
      </div>
    </div>
  )
}

function RiskGrid({ risk }) {
  const categories = [
    { key: 'delivery_risks',    label: 'Delivery',    cat: 'delivery' },
    { key: 'integration_risks', label: 'Integration', cat: 'integration' },
    { key: 'resource_risks',    label: 'Resource',    cat: 'resource' },
    { key: 'platform_risks',    label: 'Platform',    cat: 'platform' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {categories.map(({ key, label, cat }) => {
        const items = (risk || {})[key] || []
        const c = riskColor(cat)
        return (
          <div key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '5px 10px', background: c.bg, borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <BulletList items={items} color={c.accent} emptyText='None identified' />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResponseCandidateBuckets({ rc }) {
  const buckets = [
    { key: 'rr_responds',        label: 'RR Responds',        color: { bg: '#DBEAFE', text: BLUE } },
    { key: 'logicgate_validates', label: 'LogicGate Validates', color: { bg: '#F3E8FF', text: PURPLE } },
    { key: 'joint_response',     label: 'Joint Response',      color: { bg: '#D1FAE5', text: '#065F46' } },
    { key: 'can_be_ignored',     label: 'Can Be Ignored',      color: { bg: '#F1F5F9', text: MUTED } },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {buckets.map(({ key, label, color }) => {
        const items = (rc || {})[key] || []
        return (
          <div key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '6px 12px', background: color.bg, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: color.text }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: color.text }}>{items.length}</span>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <BulletList items={items} color={color.text} emptyText='None identified' />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RFPModule() {
  const [company, setCompany]           = useState('')
  const [vendorContext, setVendorContext] = useState('LogicGate')
  const [documents, setDocuments]       = useState([])
  const [pasteText, setPasteText]       = useState('')
  const [pasteName, setPasteName]       = useState('RFP Document')
  const fileInputRef                    = useRef(null)
  const [uploading, setUploading]       = useState(false)

  // OI Assessment results
  const [oiAssessment, setOiAssessment] = useState(null)
  const [documentClassifications, setDocumentClassifications] = useState([])
  // Response Candidates (per-requirement, optional)
  const [candidates, setCandidates]     = useState([])
  // Mapping Pack
  const [mappingRows, setMappingRows]   = useState([])
  const [mappingSummary, setMappingSummary] = useState(null)

  const [loading, setLoading]           = useState(null)  // 'oi' | 'map'
  const [error, setError]               = useState(null)
  const [extractProgress, setExtractProgress] = useState(null)
  const [mapProgress, setMapProgress]   = useState(null)

  // Candidate table state
  const [candFilter, setCandFilter]     = useState('All')
  const [candExpanded, setCandExpanded] = useState(null)
  // Mapping table state
  const [mapFilterOwner, setMapFilterOwner] = useState('All')
  const [mapExpanded, setMapExpanded]   = useState(null)
  const [regenRow, setRegenRow]         = useState(null)

  const pollRef    = useRef(null)
  const mapPollRef = useRef(null)

  function getDocType(id) { return documentClassifications.find((c) => c.id === id)?.docType || null }

  async function addPasted() {
    if (!pasteText.trim()) return
    setUploading(true); setError(null)
    try {
      const m = await rfpStoreText({ name: pasteName || 'RFP Document', text: pasteText.trim() })
      setDocuments((p) => [...p, { id: m.id, name: m.name, charCount: m.charCount }])
      setPasteText(''); setPasteName('RFP Document')
    } catch (e) { setError('Failed to store: ' + e.message) }
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

  async function runOI() {
    if (!documents.length) return
    setLoading('oi'); setError(null)
    setExtractProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setOiAssessment(null); setCandidates([])
    setDocumentClassifications([]); setMappingRows([]); setMappingSummary(null)

    try {
      const { jobId } = await rfpExtractRequirements({ documentIds: documents.map((d) => d.id), vendorContext, company })
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const job = await rfpGetJob(jobId)
          setExtractProgress(job.progress)
          if (job.status === 'done') {
            clearInterval(pollRef.current); pollRef.current = null
            setOiAssessment(job.assessment || null)
            setDocumentClassifications(job.documentClassifications || [])
            setCandidates(job.requirements || [])
            setLoading(null); setExtractProgress(null)
          } else if (job.status === 'error') {
            clearInterval(pollRef.current); pollRef.current = null
            setError(job.error || 'Assessment failed'); setLoading(null); setExtractProgress(null)
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setExtractProgress(null) }
  }

  async function runMappingPack() {
    const toMap = candidates.length ? candidates : []
    if (!toMap.length) return
    setLoading('map'); setError(null)
    setMapProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setMappingRows([]); setMappingSummary(null); setMapExpanded(null)

    try {
      const { jobId } = await rfpGenerateMappingPack({ requirements: toMap, vendorContext, company, rfpUnderstanding: oiAssessment })
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
    setRegenRow(req.requirement_id)
    try {
      const { row } = await rfpRegenerateMappingRow({ requirement: req, vendorContext, company, rfpUnderstanding: oiAssessment })
      if (row) updateMappingRow(req.requirement_id, row)
    } catch (e) { setError('Regen failed: ' + e.message) }
    finally { setRegenRow(null) }
  }

  const hasOI     = !!oiAssessment
  const hasCands  = candidates.length > 0
  const hasMap    = mappingRows.length > 0

  const oi = oiAssessment || {}

  // Candidate filters
  const candBuckets = ['All', 'RR', 'LogicGate', 'Joint', 'Ignore']
  const visibleCands = candFilter === 'All' ? candidates : candidates.filter((c) => c.bucket === candFilter)
  const candCounts = candBuckets.reduce((acc, b) => {
    acc[b] = b === 'All' ? candidates.length : candidates.filter((c) => c.bucket === b).length
    return acc
  }, {})

  // Mapping filters
  const mapOwners = ['All', ...Array.from(new Set(mappingRows.map((r) => r.owner).filter(Boolean)))]
  const visibleMap = mapFilterOwner === 'All' ? mappingRows : mappingRows.filter((r) => r.owner === mapFilterOwner)
  const mapOwnerCounts = ['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].reduce((acc, o) => {
    acc[o] = mappingRows.filter((r) => r.owner === o).length; return acc
  }, {})

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh', color: '#1E293B' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button:hover { opacity: 0.9; }`}</style>

      {/* Header */}
      <div style={{ background: NAVY, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: WHITE }}>Opportunity Intelligence Assessment</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Understand · Map · Own · Validate · Export</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasOI && (
            <button
              onClick={() => exportOIDocx({ oi: oiAssessment, requirements: candidates, company }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export OI Assessment
            </button>
          )}
          {hasMap && (
            <button
              onClick={() => exportMappingDocx({ oi: oiAssessment, mappingRows, mappingSummary, company }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Mapping Pack
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Setup Card ── */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
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
                <option>LogicGate</option><option>Panorays</option><option>Both</option><option>Unknown</option>
              </select>
            </div>
          </div>

          {/* Paste zone */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document name</label>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="e.g. Acme RFP"
                  style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={addPasted} disabled={!pasteText.trim()}
                style={{ background: pasteText.trim() ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                + Add
              </button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste RFP, RFI, or scope content here…" rows={3}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          {/* Drop zone */}
          <div onDrop={handleDrop} onDragOver={handleDragOver}
            style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '8px 16px', marginBottom: documents.length ? 10 : 0, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>{uploading ? '⏳' : '📎'}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{uploading ? 'Uploading…' : 'Drop files — Word, PDF, Excel, text'}</span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
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
                const dtCol = dt ? docTypeColor(dt) : null
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: LBLUE, borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                    <span>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                    <span>{d.name}</span>
                    {dt && <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: dtCol.bg, color: dtCol.text }}>{dt}</span>}
                    {d.rowCount ? <span style={{ color: MUTED, fontSize: 10 }}>({d.rowCount} rows)</span>
                      : d.charCount ? <span style={{ color: MUTED, fontSize: 10 }}>({Math.round(d.charCount / 1000)}k chars)</span> : null}
                    <button onClick={() => { rfpRemoveDocument(d.id); setDocuments((p) => p.filter((x) => x.id !== d.id)) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, padding: 0, marginLeft: 2 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress */}
          {loading === 'oi'  && extractProgress && <div style={{ marginTop: 10 }}><ProgressBar progress={extractProgress} /></div>}
          {loading === 'map' && mapProgress     && <div style={{ marginTop: 10 }}><ProgressBar progress={mapProgress} /></div>}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button onClick={runOI} disabled={!documents.length || !!loading}
              style={{ background: documents.length && !loading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed' }}>
              {loading === 'oi' ? 'Assessing opportunity…' : '1. Run Opportunity Intelligence Assessment'}
            </button>
            {hasCands && (
              <button onClick={runMappingPack} disabled={!!loading}
                style={{ background: !loading ? '#059669' : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: !loading ? 'pointer' : 'not-allowed' }}>
                {loading === 'map' ? 'Drafting responses…' : `2. Generate Mapping Pack (${candidates.length} candidates)`}
              </button>
            )}
          </div>

          {error && <div style={{ marginTop: 10, color: RED, fontSize: 12, background: '#FEE2E2', padding: '7px 12px', borderRadius: 6 }}>{error}</div>}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* OI ASSESSMENT SECTIONS                                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {hasOI && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Opportunity Intelligence Assessment — {company || 'Unknown Prospect'}
            </div>

            {/* 1. Customer Objectives */}
            <OISection number="1" title="Customer Objectives" icon="🎯">
              <BulletList items={oi.customer_objectives} color={NAVY} emptyText="No objectives extracted." />
            </OISection>

            {/* 2. Business Use Cases */}
            <OISection number="2" title="Business Use Cases" icon="📋">
              <ChipGrid items={oi.business_use_cases} colorFn={() => ({ bg: LBLUE, text: NAVY })} />
            </OISection>

            {/* 3. Capability Requirements */}
            <OISection number="3" title="Capability Requirements" icon="⚙️">
              <MiniTable
                headers={['Capability', 'RR / LG Area']}
                rows={(oi.capability_requirements || []).map((r) => [r.capability, r.rr_area])}
              />
            </OISection>

            {/* 4. LogicGate Mapping */}
            <OISection number="4" title="LogicGate Module Mapping" icon="🔷">
              <MiniTable
                headers={['Requirement Area', 'LogicGate Module']}
                rows={(oi.logicgate_mapping || []).map((r) => [r.requirement_area, <span style={{ fontWeight: 600, color: PURPLE }}>{r.logicgate_module}</span>])}
              />
            </OISection>

            {/* 5. Scope Assessment */}
            <OISection number="5" title="Scope Assessment" icon="🔭">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#D1FAE5', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase' }}>In Scope</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <BulletList items={(oi.scope_assessment || {}).in_scope} color={GREEN} emptyText="Not specified" />
                  </div>
                </div>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#FEE2E2', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase' }}>Likely Out of Scope</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <BulletList items={(oi.scope_assessment || {}).likely_out_of_scope} color={RED} emptyText="Not identified" />
                  </div>
                </div>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#FEF9C3', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, textTransform: 'uppercase' }}>Mandatory</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <BulletList items={(oi.scope_assessment || {}).mandatory_items} color={AMBER} emptyText="None identified" />
                  </div>
                </div>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '5px 10px', background: '#F1F5F9', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase' }}>Optional / Phase 2</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <BulletList items={(oi.scope_assessment || {}).optional_items} color={MUTED} emptyText="None identified" />
                  </div>
                </div>
              </div>
            </OISection>

            {/* 6. Delivery Phases */}
            <OISection number="6" title="Suggested Delivery Phases" icon="🗓️">
              {(oi.suggested_delivery_phases || []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {(oi.suggested_delivery_phases || []).map((ph, i) => <PhaseCard key={i} phase={ph} />)}
                </div>
              ) : <span style={{ fontSize: 12, color: MUTED }}>No phases suggested.</span>}
            </OISection>

            {/* 7. Resource Assessment */}
            <OISection number="7" title="Resource Assessment" icon="👤">
              <MiniTable
                headers={['Role', 'Justification']}
                rows={(oi.resource_assessment || []).map((r) => [<span style={{ fontWeight: 600 }}>{r.role}</span>, r.justification])}
              />
            </OISection>

            {/* 8. Integration Assessment */}
            <OISection number="8" title="Integration Assessment" icon="🔗">
              <TwoCol>
                <div>
                  <SubSection title="Likely Integrations" color={TEAL}>
                    <BulletList items={(oi.integration_assessment || {}).likely_integrations} color={TEAL} />
                  </SubSection>
                  <SubSection title="Data Sources" color={TEAL}>
                    <BulletList items={(oi.integration_assessment || {}).data_sources} color={TEAL} />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="API Dependencies" color={TEAL}>
                    <BulletList items={(oi.integration_assessment || {}).api_dependencies} color={TEAL} emptyText="None identified" />
                  </SubSection>
                </div>
              </TwoCol>
            </OISection>

            {/* 9. Data Migration */}
            <OISection number="9" title="Data Migration Assessment" icon="🗃️">
              <TwoCol>
                <div>
                  <SubSection title="Likely Requirements">
                    <BulletList items={(oi.data_migration_assessment || {}).likely_requirements} />
                  </SubSection>
                  <SubSection title="Assumptions" color={AMBER}>
                    <BulletList items={(oi.data_migration_assessment || {}).assumptions} color={AMBER} emptyText="None stated" />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Complexity">
                    {(() => {
                      const c = (oi.data_migration_assessment || {}).complexity || 'Unknown'
                      const col = c === 'High' ? { bg: '#FEE2E2', text: RED } : c === 'Medium' ? { bg: '#FEF9C3', text: AMBER } : c === 'Low' ? { bg: '#D1FAE5', text: GREEN } : { bg: '#F1F5F9', text: MUTED }
                      return <span style={{ padding: '4px 12px', borderRadius: 14, fontWeight: 700, fontSize: 13, background: col.bg, color: col.text }}>{c}</span>
                    })()}
                  </SubSection>
                </div>
              </TwoCol>
            </OISection>

            {/* 10. Support Assessment */}
            <OISection number="10" title="Support Assessment" icon="🛎️">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <SubSection title="Support Expectations">
                    <BulletList items={(oi.support_assessment || {}).support_expectations} />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Hypercare Requirements" color={AMBER}>
                    <BulletList items={(oi.support_assessment || {}).hypercare_requirements} color={AMBER} emptyText="None identified" />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Training Obligations">
                    <BulletList items={(oi.support_assessment || {}).training_obligations} emptyText="None identified" />
                  </SubSection>
                </div>
              </div>
            </OISection>

            {/* 11. Geographic & Timezone */}
            <OISection number="11" title="Geographic & Timezone Assessment" icon="🌍">
              <TwoCol>
                <div>
                  <SubSection title="Operating Regions" color={TEAL}>
                    <ChipGrid items={(oi.geographic_assessment || {}).operating_regions} colorFn={() => ({ bg: '#CCFBF1', text: TEAL })} />
                  </SubSection>
                  <SubSection title="Implementation Timezone" style={{ marginTop: 12 }}>
                    <BulletList items={(oi.geographic_assessment || {}).implementation_timezone_impacts} emptyText="Not specified" />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Support Timezone">
                    <BulletList items={(oi.geographic_assessment || {}).support_timezone_impacts} emptyText="Not specified" />
                  </SubSection>
                </div>
              </TwoCol>
            </OISection>

            {/* 12. Risk Assessment */}
            <OISection number="12" title="Risk Assessment" icon="⚠️">
              <RiskGrid risk={oi.risk_assessment} />
            </OISection>

            {/* 13. Open Questions */}
            <OISection number="13" title="Open Questions" icon="❓">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <SubSection title="Customer Clarification" color={NAVY}>
                    <QList items={(oi.open_questions || {}).customer_clarification} color={NAVY} emptyText="None identified" />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Vendor Clarification" color={PURPLE}>
                    <QList items={(oi.open_questions || {}).vendor_clarification} color={PURPLE} emptyText="None identified" />
                  </SubSection>
                </div>
                <div>
                  <SubSection title="Scope Clarification" color={AMBER}>
                    <QList items={(oi.open_questions || {}).scope_clarification} color={AMBER} emptyText="None identified" />
                  </SubSection>
                </div>
              </div>
            </OISection>

            {/* 14. Response Candidates (high-level) */}
            <OISection number="14" title="Response Candidates" icon="📬">
              <ResponseCandidateBuckets rc={oi.response_candidates} />
            </OISection>

            {/* ── Per-requirement candidates table ── */}
            {hasCands && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Response Candidates — {candidates.length} requirements
                </div>

                {/* Bucket tab filter */}
                <div style={{ display: 'flex', gap: 0, border: `1px solid ${BORDER}`, borderBottom: 'none', borderRadius: '6px 6px 0 0', overflow: 'hidden', background: WHITE }}>
                  {candBuckets.map((b) => (
                    <button key={b} onClick={() => { setCandFilter(b); setCandExpanded(null) }}
                      style={{
                        padding: '9px 16px', fontSize: 12, fontWeight: candFilter === b ? 700 : 500,
                        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                        background: candFilter === b ? NAVY : WHITE,
                        color: candFilter === b ? WHITE : MUTED,
                        borderRight: `1px solid ${BORDER}`,
                      }}>
                      {b} <span style={{ fontWeight: 400, opacity: 0.75 }}>({candCounts[b]})</span>
                    </button>
                  ))}
                </div>

                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: '0 0 6px 6px', overflow: 'hidden', marginBottom: 24 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: `2px solid ${BORDER}` }}>
                          {['Ref', 'Requirement', 'Bucket', 'M/O', 'Reason', ''].map((h, i) => (
                            <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: i === 5 ? 24 : 'auto' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCands.map((c, i) => {
                          const bc = bucketColor(c.bucket)
                          const exp = candExpanded === c.requirement_id
                          return (
                            <React.Fragment key={c.requirement_id || i}>
                              <tr onClick={() => setCandExpanded(exp ? null : c.requirement_id)}
                                style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: exp ? LBLUE : i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, fontSize: 11, whiteSpace: 'nowrap' }}>{c.requirement_id}</td>
                                <td style={{ padding: '8px 12px', maxWidth: 320 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.original_question}</div>
                                </td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><Badge label={c.bucket || '—'} color={bc} /></td>
                                <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11, whiteSpace: 'nowrap' }}>{c.mandatory_optional || '—'}</td>
                                <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MUTED }}>{c.reason || '—'}</div>
                                </td>
                                <td style={{ padding: '8px 8px', textAlign: 'center', color: MUTED, fontSize: 9 }}>{exp ? '▲' : '▼'}</td>
                              </tr>
                              {exp && (
                                <tr style={{ background: LBLUE }}>
                                  <td colSpan={6} style={{ padding: '14px 18px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                                      <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>Full Requirement</div>
                                        <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6, padding: '10px 12px', background: WHITE, borderRadius: 5, border: `1px solid ${BORDER}`, marginBottom: 10 }}>{c.original_question}</div>
                                        <div style={{ fontSize: 11, color: MUTED }}>
                                          {c.source_document && <><strong>Source:</strong> {c.source_document}{'  '}</>}
                                          {c.category && <><strong>Category:</strong> {c.category}</>}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>Reason</div>
                                        <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{c.reason || '—'}</div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                        {!visibleCands.length && (
                          <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED }}>No candidates in this filter.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '7px 14px', borderTop: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, background: '#FAFBFC' }}>
                    Showing {visibleCands.length} of {candidates.length}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MAPPING PACK                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {hasMap && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Response Mapping Pack — {mappingRows.length} requirements mapped
            </div>

            {/* Owner filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {['All', 'RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => {
                const count = o === 'All' ? mappingRows.length : mapOwnerCounts[o] || 0
                if (o !== 'All' && count === 0) return null
                const active = mapFilterOwner === o
                const c = ownerColor(o)
                return (
                  <button key={o} onClick={() => setMapFilterOwner(o)}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? c.text : BORDER}`, background: active ? c.bg : WHITE, color: active ? c.text : MUTED }}>
                    {o} ({count})
                  </button>
                )
              })}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{visibleMap.length} / {mappingRows.length}</span>
            </div>

            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: NAVY, color: WHITE }}>
                      {['Ref', 'Requirement', 'Category', 'Owner', 'Conf.', 'Vendor?', 'Status', ''].map((h, i) => (
                        <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: i === 1 ? 'normal' : 'nowrap', width: i === 7 ? 28 : 'auto' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMap.map((req, i) => {
                      const exp = mapExpanded === req.requirement_id
                      const oc = ownerColor(req.owner)
                      const confCol = req.confidence === 'High' ? GREEN : req.confidence === 'Medium' ? AMBER : RED
                      return (
                        <React.Fragment key={req.requirement_id || i}>
                          <tr onClick={() => setMapExpanded(exp ? null : req.requirement_id)}
                            style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, fontSize: 11, whiteSpace: 'nowrap' }}>{req.requirement_id}</td>
                            <td style={{ padding: '8px 12px', maxWidth: 340 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.original_question}</div>
                            </td>
                            <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11, whiteSpace: 'nowrap' }}>{req.category}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              {req.owner ? <Badge label={req.owner} color={oc} /> : <span style={{ color: BORDER }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, color: confCol, whiteSpace: 'nowrap' }}>{req.confidence || '—'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: req.vendor_validation_required ? GREEN : MUTED }}>
                              {req.vendor_validation_required ? 'Y' : 'N'}
                            </td>
                            <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11 }}>{req.status || 'Draft'}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'center', color: MUTED, fontSize: 9 }}>{exp ? '▲' : '▼'}</td>
                          </tr>

                          {exp && (
                            <tr style={{ background: LBLUE }}>
                              <td colSpan={8} style={{ padding: '18px 22px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>Requirement</div>
                                    <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.5, marginBottom: 14 }}>{req.original_question}</div>
                                    {req.rr_capability_mapping && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, textTransform: 'uppercase', marginBottom: 4 }}>RR Capability</div>
                                        <div style={{ fontSize: 12, lineHeight: 1.5, padding: '8px 10px', background: '#EFF6FF', borderRadius: 5 }}>{req.rr_capability_mapping}</div>
                                      </div>
                                    )}
                                    {req.logicgate_mapping && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', marginBottom: 4 }}>LogicGate</div>
                                        <div style={{ fontSize: 12, lineHeight: 1.5, padding: '8px 10px', background: '#F5F3FF', borderRadius: 5 }}>{req.logicgate_mapping}</div>
                                      </div>
                                    )}
                                    {req.assumptions && <div style={{ fontSize: 11, color: AMBER }}><strong>Assumptions:</strong> {req.assumptions}</div>}
                                    {req.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}><strong>Note:</strong> {req.notes}</div>}
                                  </div>
                                  <div>
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', marginBottom: 5 }}>Owner</div>
                                      <select value={req.owner || 'Unknown'} onChange={(e) => updateMappingRow(req.requirement_id, { owner: e.target.value })} onClick={(e) => e.stopPropagation()}
                                        style={{ padding: '5px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, background: WHITE }}>
                                        {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                                      </select>
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', marginBottom: 5 }}>Draft RR Response</div>
                                      <textarea value={req.draft_rr_response || ''} onChange={(e) => updateMappingRow(req.requirement_id, { draft_rr_response: e.target.value })} onClick={(e) => e.stopPropagation()}
                                        rows={4} placeholder="No RR-owned response drafted"
                                        style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                    </div>
                                    {(req.vendor_validation_required || req.vendor_question_or_prompt) && (
                                      <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', marginBottom: 5 }}>Vendor Prompt</div>
                                        <textarea value={req.vendor_question_or_prompt || ''} onChange={(e) => updateMappingRow(req.requirement_id, { vendor_question_or_prompt: e.target.value })} onClick={(e) => e.stopPropagation()}
                                          rows={2}
                                          style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <select value={req.status || 'Draft'} onChange={(e) => updateMappingRow(req.requirement_id, { status: e.target.value })} onClick={(e) => e.stopPropagation()}
                                        style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12 }}>
                                        {['Draft', 'In Review', 'Approved', 'Sent'].map((s) => <option key={s}>{s}</option>)}
                                      </select>
                                      <button onClick={(e) => { e.stopPropagation(); regenerateRow(req) }} disabled={regenRow === req.requirement_id}
                                        style={{ padding: '5px 12px', background: regenRow === req.requirement_id ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 5, fontSize: 11, cursor: regenRow === req.requirement_id ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                                        {regenRow === req.requirement_id ? '…' : '↻ Regen'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pack summary */}
            {mappingSummary && (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Pack Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    {Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length > 0 && (
                      <SubSection title="Gaps & Risks" color={AMBER}>
                        {mappingSummary.gaps_and_risks.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, lineHeight: 1.5 }}>
                            <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {item}
                          </div>
                        ))}
                      </SubSection>
                    )}
                    {Array.isArray(mappingSummary.assumptions) && mappingSummary.assumptions.length > 0 && (
                      <SubSection title="Assumptions">
                        <BulletList items={mappingSummary.assumptions} />
                      </SubSection>
                    )}
                  </div>
                  <div>
                    {Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length > 0 && (
                      <SubSection title="Next Actions" color={GREEN}>
                        {mappingSummary.recommended_next_actions.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, lineHeight: 1.5 }}>
                            <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {item}
                          </div>
                        ))}
                      </SubSection>
                    )}
                    {Array.isArray(mappingSummary.commercial_delivery_considerations) && mappingSummary.commercial_delivery_considerations.length > 0 && (
                      <SubSection title="Commercial & Delivery">
                        <BulletList items={mappingSummary.commercial_delivery_considerations} />
                      </SubSection>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

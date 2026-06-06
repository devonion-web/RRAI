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
function confColor(c) {
  if (c === 'High')   return { bg: '#D1FAE5', text: GREEN }
  if (c === 'Medium') return { bg: '#FEF9C3', text: AMBER }
  return { bg: '#FEE2E2', text: RED }
}

function ownerColor(owner) {
  switch (owner) {
    case 'RR':        return { bg: '#DBEAFE', text: BLUE }
    case 'LogicGate': return { bg: '#F3E8FF', text: PURPLE }
    case 'Panorays':  return { bg: '#FCE7F3', text: '#BE185D' }
    case 'Joint':     return { bg: '#D1FAE5', text: '#065F46' }
    case 'Ignore':    return { bg: '#F1F5F9', text: '#94A3B8' }
    default:          return { bg: '#F1F5F9', text: MUTED }
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
    'RFP Overview':             { bg: '#D1FAE5', text: GREEN },
    'Scope Document':           { bg: '#F3E8FF', text: PURPLE },
    'Evaluation Criteria':      { bg: '#FEF9C3', text: AMBER },
    'Procurement Instructions': { bg: '#E0F2FE', text: '#0369A1' },
    'Commercial Requirements':  { bg: '#FCE7F3', text: '#BE185D' },
    'Security Requirements':    { bg: '#FEE2E2', text: RED },
    'Supporting Material':      { bg: '#F1F5F9', text: '#475569' },
  }
  return m[dt] || { bg: '#F1F5F9', text: MUTED }
}

// ── Small atoms ───────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: color.bg, color: color.text, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function Pill({ label, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: color.bg, color: color.text, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function BulletList({ items, color = NAVY, emptyText = '—' }) {
  if (!items || !items.length) return <span style={{ color: MUTED, fontSize: 12, fontStyle: 'italic' }}>{emptyText}</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>
          <span style={{ color, flexShrink: 0, fontSize: 9, marginTop: 4 }}>▸</span>
          <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children, color = MUTED }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{children}</div>
}

function Card({ children, style }) {
  return <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, ...style }}>{children}</div>
}

function ActivityCard({ icon, title, items, accent }) {
  return (
    <Card>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent || NAVY }}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: MUTED }}>{items?.length || 0}</span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <BulletList items={items} color={accent || NAVY} emptyText='None identified' />
      </div>
    </Card>
  )
}

function SupportCard({ title, items, color }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', background: color.bg || '#F8FAFC', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: color.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <BulletList items={items} color={color.text} emptyText='None identified' />
      </div>
    </div>
  )
}

function RiskPanel({ title, items, accent }) {
  const count = items?.length || 0
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: accent, color: WHITE, padding: '1px 6px', borderRadius: 10 }}>{count}</span>}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <BulletList items={items} color={accent} emptyText='None identified' />
      </div>
    </div>
  )
}

function ProgressBar({ progress }) {
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 5
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{progress.stage}</span>
        <span style={{ fontSize: 11, color: MUTED }}>{progress.done}/{progress.total}</span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: NAVY, borderRadius: 2, width: `${Math.max(pct, 3)}%`, transition: 'width 0.4s ease' }} />
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
function dBullet(text) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { after: 60, line: 260 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}
function dSpacer() { return new Paragraph({ children: [new TextRun('')], spacing: { before: 60, after: 60 } }) }
function dDivider() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: '', size: 4 })],
    border: { bottom: { style: 'single', size: 4, color: 'E2E8F0', space: 1 } },
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

async function exportOIDocx({ oi, requirements, company }) {
  const a = oi || {}
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const children = []

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

  // Use Cases
  children.push(dH('1. Use Case Assessment'))
  children.push(dSpacer())
  if (Array.isArray(a.use_cases)) {
    const hdr = new TableRow({ tableHeader: true, children: ['Use Case', 'Confidence', 'Business Importance', 'Source'].map(tblH) })
    const rows = a.use_cases.map((uc) => new TableRow({ children: [tblC(uc.name), tblC(uc.confidence), tblC(uc.business_importance), tblC((uc.source_references || []).join(', '))] }))
    if (rows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
  }
  children.push(dSpacer())

  // LG Mapping
  if (Array.isArray(a.logicgate_mapping) && a.logicgate_mapping.length) {
    children.push(dH('2. LogicGate Module Mapping'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Use Case', 'LogicGate Module'].map(tblH) })
    const rows = a.logicgate_mapping.map((r) => new TableRow({ children: [tblC(r.use_case), tblC(r.logicgate_module)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
    children.push(dSpacer())
  }
  children.push(dDivider())

  // Delivery Assessment
  children.push(dH('3. Delivery Assessment'))
  const da = a.delivery_assessment || {}
  const daCats = [
    ['Discovery', da.discovery_activities],
    ['Configuration', da.configuration_activities],
    ['Data', da.data_activities],
    ['Integrations', da.integration_activities],
    ['Testing', da.testing_activities],
    ['Change', da.change_activities],
  ]
  daCats.forEach(([label, items]) => {
    if (Array.isArray(items) && items.length) {
      children.push(dSub(label))
      items.forEach((item) => children.push(dBullet(String(item))))
      children.push(dSpacer())
    }
  })
  children.push(dDivider())

  // Support Assessment
  children.push(dH('4. Support Assessment'))
  const sa = a.support_assessment || {}
  const saCats = [
    ['Hypercare', sa.hypercare_requirements],
    ['Training', sa.training_requirements],
    ['Platform Support', sa.platform_support_expectations],
    ['Admin Support', sa.admin_support_requirements],
    ['Managed Service', sa.managed_service_opportunities],
    ['Reporting Support', sa.reporting_support_requirements],
    ['Enhancements', sa.enhancement_requirements],
  ]
  saCats.forEach(([label, items]) => {
    if (Array.isArray(items) && items.length) {
      children.push(dSub(label))
      items.forEach((item) => children.push(dBullet(String(item))))
      children.push(dSpacer())
    }
  })
  children.push(dDivider())

  // Geographic
  children.push(dH('5. Geographic & Coverage Assessment'))
  const geo = a.geographic_assessment || {}
  const geoCats = [
    ['Regions', geo.regions], ['Countries', geo.countries], ['Languages', geo.languages],
    ['Timezones', geo.timezones], ['Support Coverage', geo.support_coverage_requirements], ['Delivery Constraints', geo.delivery_constraints],
  ]
  geoCats.forEach(([label, items]) => {
    if (Array.isArray(items) && items.length) {
      children.push(dSub(label))
      items.forEach((item) => children.push(dBullet(String(item))))
      children.push(dSpacer())
    }
  })
  children.push(dDivider())

  // Risks
  children.push(dH('6. Delivery Risks'))
  const dr = a.delivery_risks || {}
  const drCats = [
    ['Delivery', dr.delivery_risks], ['Integration', dr.integration_risks], ['Data', dr.data_risks],
    ['Resource', dr.resource_risks], ['Support', dr.support_risks], ['Timeline', dr.timeline_risks],
  ]
  drCats.forEach(([label, items]) => {
    if (Array.isArray(items) && items.length) {
      children.push(dSub(label))
      items.forEach((item) => children.push(dBullet(String(item))))
      children.push(dSpacer())
    }
  })
  children.push(dDivider())

  // Response Identification
  children.push(dH('7. Response Identification'))
  const ri = a.response_identification || {}
  const riCats = [
    ['RR Must Answer', ri.rr_must_answer],
    ['LogicGate Must Validate', ri.logicgate_must_validate],
    ['Joint Response', ri.joint_response],
  ]
  riCats.forEach(([label, items]) => {
    if (Array.isArray(items) && items.length) {
      children.push(dSub(label))
      items.forEach((item) => {
        const t = typeof item === 'object' ? `${item.topic} — ${item.reason}` : String(item)
        children.push(dBullet(t))
      })
      children.push(dSpacer())
    }
  })

  // Per-requirement candidates
  if (requirements?.length) {
    children.push(dDivider())
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
  }

  const rrOwned = mappingRows.filter((r) => r.owner === 'RR' && r.draft_rr_response)
  if (rrOwned.length) {
    children.push(dDivider())
    children.push(dH('RR-Owned Draft Responses'))
    children.push(dSpacer())
    const hdr = new TableRow({ tableHeader: true, children: ['Ref', 'Question', 'Draft RR Response', 'Assumptions'].map(tblH) })
    const rows = rrOwned.map((r) => new TableRow({ children: [
      tblC(r.requirement_id),
      tblC(typeof r.original_question === 'string' ? r.original_question.slice(0, 150) : ''),
      tblC(r.draft_rr_response), tblC(r.assumptions || '—'),
    ]}))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TBORDERS, rows: [hdr, ...rows] }))
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Mapping-Pack-${(company || 'Unknown').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'usecases',   label: 'Use Cases',        icon: '📋' },
  { id: 'delivery',   label: 'Delivery Impact',   icon: '🏗️' },
  { id: 'support',    label: 'Support Impact',    icon: '🛎️' },
  { id: 'workbench',  label: 'Response Workbench',icon: '📬' },
]

// ── Tab 1: Use Cases ─────────────────────────────────────────────────────────
function TabUseCases({ oi }) {
  const useCases = oi.use_cases || []
  const lgMap    = oi.logicgate_mapping || []

  return (
    <div>
      {/* Use case cards */}
      <SectionLabel color={NAVY}>Use Cases  <span style={{ fontWeight: 400, color: MUTED }}>— what business capabilities are required</span></SectionLabel>
      {useCases.length === 0 && <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No use cases identified.</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 28 }}>
        {useCases.map((uc, i) => (
          <Card key={i}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{uc.name}</span>
              <Badge label={uc.confidence || '—'} color={confColor(uc.confidence)} />
            </div>
            <div style={{ padding: '10px 14px' }}>
              {uc.business_importance && (
                <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5, marginBottom: 8 }}>{uc.business_importance}</div>
              )}
              {Array.isArray(uc.source_references) && uc.source_references.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {uc.source_references.map((src, j) => (
                    <span key={j} style={{ fontSize: 10, color: BLUE, background: '#EFF6FF', padding: '1px 7px', borderRadius: 10 }}>{src}</span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* LogicGate mapping */}
      {lgMap.length > 0 && (
        <>
          <SectionLabel color={PURPLE}>LogicGate Module Mapping</SectionLabel>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: WHITE, fontWeight: 600, width: '50%' }}>Use Case</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', color: WHITE, fontWeight: 600 }}>LogicGate Module</th>
                </tr>
              </thead>
              <tbody>
                {lgMap.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                    <td style={{ padding: '8px 14px', color: '#1E293B' }}>{row.use_case}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: PURPLE }}>{row.logicgate_module}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab 2: Delivery Impact ───────────────────────────────────────────────────
function TabDelivery({ oi }) {
  const da = oi.delivery_assessment || {}
  const activities = [
    { icon: '🔍', title: 'Discovery Activities',     key: 'discovery_activities',     accent: NAVY },
    { icon: '⚙️', title: 'Configuration Activities', key: 'configuration_activities', accent: BLUE },
    { icon: '🗃️', title: 'Data Activities',           key: 'data_activities',          accent: TEAL },
    { icon: '🔗', title: 'Integration Activities',   key: 'integration_activities',   accent: PURPLE },
    { icon: '🧪', title: 'Testing Activities',        key: 'testing_activities',       accent: GREEN },
    { icon: '🎓', title: 'Change Activities',         key: 'change_activities',        accent: AMBER },
  ]

  return (
    <div>
      <SectionLabel color={NAVY}>What RR would need to deliver</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {activities.map(({ icon, title, key, accent }) => (
          <ActivityCard key={key} icon={icon} title={title} items={da[key]} accent={accent} />
        ))}
      </div>
    </div>
  )
}

// ── Tab 3: Support Impact ────────────────────────────────────────────────────
function TabSupport({ oi }) {
  const sa  = oi.support_assessment || {}
  const geo = oi.geographic_assessment || {}
  const dr  = oi.delivery_risks || {}

  const supportCats = [
    { title: 'Hypercare',          items: sa.hypercare_requirements,       color: { bg: '#FEE2E2', text: RED } },
    { title: 'Training',           items: sa.training_requirements,         color: { bg: '#FEF9C3', text: AMBER } },
    { title: 'Platform Support',   items: sa.platform_support_expectations, color: { bg: '#EFF6FF', text: BLUE } },
    { title: 'Admin Support',      items: sa.admin_support_requirements,    color: { bg: '#F1F5F9', text: MUTED } },
    { title: 'Managed Service',    items: sa.managed_service_opportunities, color: { bg: '#D1FAE5', text: GREEN } },
    { title: 'Reporting Support',  items: sa.reporting_support_requirements,color: { bg: '#EDE9FE', text: PURPLE } },
    { title: 'Enhancements',       items: sa.enhancement_requirements,      color: { bg: '#F0FDF4', text: TEAL } },
  ]

  const riskCats = [
    { title: 'Delivery',    items: dr.delivery_risks,    accent: RED },
    { title: 'Integration', items: dr.integration_risks, accent: AMBER },
    { title: 'Data',        items: dr.data_risks,        accent: TEAL },
    { title: 'Resource',    items: dr.resource_risks,    accent: PURPLE },
    { title: 'Support',     items: dr.support_risks,     accent: BLUE },
    { title: 'Timeline',    items: dr.timeline_risks,    accent: '#BE185D' },
  ]

  return (
    <div>
      {/* Support */}
      <SectionLabel color={NAVY} style={{ marginBottom: 10 }}>What RR would need to support</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 28 }}>
        {supportCats.map(({ title, items, color }) => (
          <SupportCard key={title} title={title} items={items} color={color} />
        ))}
      </div>

      {/* Geographic */}
      <SectionLabel color={TEAL}>Geographic & Coverage Assessment</SectionLabel>
      <Card style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          {[
            { label: 'Regions',            items: geo.regions },
            { label: 'Countries',          items: geo.countries },
            { label: 'Languages',          items: geo.languages },
            { label: 'Timezones',          items: geo.timezones },
            { label: 'Support Coverage',   items: geo.support_coverage_requirements },
            { label: 'Delivery Constraints',items: geo.delivery_constraints },
          ].map(({ label, items }, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRight: i % 3 !== 2 ? `1px solid ${BORDER}` : 'none', borderBottom: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
              <SectionLabel color={TEAL}>{label}</SectionLabel>
              {Array.isArray(items) && items.length > 0
                ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {items.map((item, j) => (
                      <Pill key={j} label={String(item)} color={{ bg: '#CCFBF1', text: TEAL }} />
                    ))}
                  </div>
                )
                : <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Not specified</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Risks */}
      <SectionLabel color={RED}>Delivery Risks</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {riskCats.map(({ title, items, accent }) => (
          <RiskPanel key={title} title={title} items={items} accent={accent} />
        ))}
      </div>
    </div>
  )
}

// ── Tab 4: Response Workbench ─────────────────────────────────────────────────
function TabWorkbench({ oi, candidates }) {
  const [candFilter, setCandFilter] = useState('All')
  const [expanded, setExpanded]     = useState(null)

  const ri = oi.response_identification || {}
  const rrItems  = ri.rr_must_answer         || []
  const lgItems  = ri.logicgate_must_validate || []
  const jntItems = ri.joint_response          || []

  const candBuckets = ['All', 'RR', 'LogicGate', 'Joint', 'Ignore']
  const visibleCands = candFilter === 'All' ? candidates : candidates.filter((c) => c.bucket === candFilter)
  const candCounts = candBuckets.reduce((acc, b) => {
    acc[b] = b === 'All' ? candidates.length : candidates.filter((c) => c.bucket === b).length
    return acc
  }, {})

  function ResponseTopic({ item, color }) {
    return (
      <div style={{ padding: '8px 10px', borderRadius: 5, border: `1px solid ${BORDER}`, marginBottom: 8, background: WHITE }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 3 }}>
          {typeof item === 'object' ? item.topic : String(item)}
        </div>
        {typeof item === 'object' && item.reason && (
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{item.reason}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* High-level response identification */}
      <SectionLabel color={NAVY}>What questions actually require responses</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
        {/* RR Must Answer */}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#DBEAFE', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>RR Must Answer</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{rrItems.length}</span>
          </div>
          <div style={{ padding: '12px 14px', background: '#F8FAFC', minHeight: 80 }}>
            {rrItems.length === 0 && <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span>}
            {rrItems.map((item, i) => <ResponseTopic key={i} item={item} color={BLUE} />)}
          </div>
        </div>

        {/* LG Must Validate */}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#F3E8FF', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE }}>LogicGate Must Validate</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE }}>{lgItems.length}</span>
          </div>
          <div style={{ padding: '12px 14px', background: '#FAFAFF', minHeight: 80 }}>
            {lgItems.length === 0 && <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span>}
            {lgItems.map((item, i) => <ResponseTopic key={i} item={item} color={PURPLE} />)}
          </div>
        </div>

        {/* Joint Response */}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#D1FAE5', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>Joint Response</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{jntItems.length}</span>
          </div>
          <div style={{ padding: '12px 14px', background: '#F0FFF8', minHeight: 80 }}>
            {jntItems.length === 0 && <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span>}
            {jntItems.map((item, i) => <ResponseTopic key={i} item={item} color='#065F46' />)}
          </div>
        </div>
      </div>

      {/* Per-requirement candidates table (only if requirements matrices were uploaded) */}
      {candidates.length > 0 && (
        <>
          <SectionLabel color={NAVY}>
            Response Candidates — Detail
            <span style={{ fontWeight: 400, color: MUTED, marginLeft: 6 }}>({candidates.length} requirements)</span>
          </SectionLabel>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 0, borderRadius: '6px 6px 0 0', overflow: 'hidden', border: `1px solid ${BORDER}`, borderBottom: 'none', background: WHITE }}>
            {candBuckets.map((b) => {
              const active = candFilter === b
              const bc = b !== 'All' ? bucketColor(b) : { bg: NAVY, text: WHITE }
              return (
                <button key={b} onClick={() => { setCandFilter(b); setExpanded(null) }}
                  style={{
                    padding: '8px 16px', fontSize: 12, fontWeight: active ? 700 : 500, border: 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap', borderRight: `1px solid ${BORDER}`,
                    background: active ? (b === 'All' ? NAVY : bc.bg) : WHITE,
                    color: active ? (b === 'All' ? WHITE : bc.text) : MUTED,
                  }}>
                  {b} <span style={{ fontWeight: 400, opacity: 0.7 }}>({candCounts[b]})</span>
                </button>
              )
            })}
          </div>

          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: `2px solid ${BORDER}` }}>
                  {['Ref', 'Requirement', 'Bucket', 'M/O', 'Reason', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCands.map((c, i) => {
                  const bc = bucketColor(c.bucket)
                  const exp = expanded === c.requirement_id
                  return (
                    <React.Fragment key={c.requirement_id || i}>
                      <tr onClick={() => setExpanded(exp ? null : c.requirement_id)}
                        style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: exp ? LBLUE : i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, fontSize: 11, whiteSpace: 'nowrap' }}>{c.requirement_id}</td>
                        <td style={{ padding: '8px 12px', maxWidth: 340 }}>
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
                                <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6, padding: '10px 12px', background: WHITE, borderRadius: 5, border: `1px solid ${BORDER}`, marginBottom: 8 }}>{c.original_question}</div>
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
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No candidates in this filter.</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ padding: '7px 14px', borderTop: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, background: '#FAFBFC' }}>
              Showing {visibleCands.length} of {candidates.length}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mapping Pack section ──────────────────────────────────────────────────────
function MappingPackSection({ mappingRows, mappingSummary, oiAssessment, vendorContext, company, onUpdate, onRegen, regenRow }) {
  const [mapFilterOwner, setMapFilterOwner] = useState('All')
  const [mapExpanded, setMapExpanded]       = useState(null)

  const mapOwnerCounts = ['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].reduce((acc, o) => {
    acc[o] = mappingRows.filter((r) => r.owner === o).length; return acc
  }, {})
  const visibleMap = mapFilterOwner === 'All' ? mappingRows : mappingRows.filter((r) => r.owner === mapFilterOwner)

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Response Mapping Pack — {mappingRows.length} requirements mapped
      </div>

      {/* Owner filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => {
          const count = o === 'All' ? mappingRows.length : (mapOwnerCounts[o] || 0)
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
              <tr style={{ background: NAVY }}>
                {['Ref', 'Requirement', 'Category', 'Owner', 'Conf.', 'Vendor?', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: WHITE, whiteSpace: 'nowrap' }}>{h}</th>
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
                              <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.5, marginBottom: 12 }}>{req.original_question}</div>
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
                              {req.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}><strong>Note:</strong> {req.notes}</div>}
                            </div>
                            <div>
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', marginBottom: 5 }}>Owner</div>
                                <select value={req.owner || 'Unknown'} onChange={(e) => onUpdate(req.requirement_id, { owner: e.target.value })} onClick={(e) => e.stopPropagation()}
                                  style={{ padding: '5px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12 }}>
                                  {['RR', 'LogicGate', 'Panorays', 'Joint', 'Unknown'].map((o) => <option key={o}>{o}</option>)}
                                </select>
                              </div>
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', marginBottom: 5 }}>Draft RR Response</div>
                                <textarea value={req.draft_rr_response || ''} onChange={(e) => onUpdate(req.requirement_id, { draft_rr_response: e.target.value })} onClick={(e) => e.stopPropagation()}
                                  rows={4} placeholder="No RR-owned response drafted"
                                  style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                              </div>
                              {(req.vendor_validation_required || req.vendor_question_or_prompt) && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', marginBottom: 5 }}>Vendor Prompt</div>
                                  <textarea value={req.vendor_question_or_prompt || ''} onChange={(e) => onUpdate(req.requirement_id, { vendor_question_or_prompt: e.target.value })} onClick={(e) => e.stopPropagation()}
                                    rows={2}
                                    style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <select value={req.status || 'Draft'} onChange={(e) => onUpdate(req.requirement_id, { status: e.target.value })} onClick={(e) => e.stopPropagation()}
                                  style={{ padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 12 }}>
                                  {['Draft', 'In Review', 'Approved', 'Sent'].map((s) => <option key={s}>{s}</option>)}
                                </select>
                                <button onClick={(e) => { e.stopPropagation(); onRegen(req) }} disabled={regenRow === req.requirement_id}
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
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Pack Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              {Array.isArray(mappingSummary.gaps_and_risks) && mappingSummary.gaps_and_risks.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionLabel color={AMBER}>Gaps & Risks</SectionLabel>
                  {mappingSummary.gaps_and_risks.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, lineHeight: 1.5 }}>
                      <span style={{ color: AMBER, flexShrink: 0 }}>⚠</span> {item}
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(mappingSummary.assumptions) && mappingSummary.assumptions.length > 0 && (
                <div>
                  <SectionLabel>Assumptions</SectionLabel>
                  <BulletList items={mappingSummary.assumptions} />
                </div>
              )}
            </div>
            <div>
              {Array.isArray(mappingSummary.recommended_next_actions) && mappingSummary.recommended_next_actions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionLabel color={GREEN}>Next Actions</SectionLabel>
                  {mappingSummary.recommended_next_actions.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4, fontSize: 12, lineHeight: 1.5 }}>
                      <span style={{ color: NAVY, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {item}
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(mappingSummary.commercial_delivery_considerations) && mappingSummary.commercial_delivery_considerations.length > 0 && (
                <div>
                  <SectionLabel>Commercial & Delivery</SectionLabel>
                  <BulletList items={mappingSummary.commercial_delivery_considerations} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

  const [oiAssessment, setOiAssessment] = useState(null)
  const [documentClassifications, setDocumentClassifications] = useState([])
  const [candidates, setCandidates]     = useState([])
  const [mappingRows, setMappingRows]   = useState([])
  const [mappingSummary, setMappingSummary] = useState(null)

  const [activeTab, setActiveTab]       = useState('usecases')
  const [loading, setLoading]           = useState(null)
  const [error, setError]               = useState(null)
  const [extractProgress, setExtractProgress] = useState(null)
  const [mapProgress, setMapProgress]   = useState(null)
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
      if (bad.length) setError(`Could not extract: ${bad.map((f) => f.name).join(', ')}`)
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
            setActiveTab('usecases')
          } else if (job.status === 'error') {
            clearInterval(pollRef.current); pollRef.current = null
            setError(job.error || 'Assessment failed'); setLoading(null); setExtractProgress(null)
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (e) { setError(e.message); setLoading(null); setExtractProgress(null) }
  }

  async function runMappingPack() {
    if (!candidates.length) return
    setLoading('map'); setError(null)
    setMapProgress({ done: 0, total: 1, stage: 'Submitting…' })
    setMappingRows([]); setMappingSummary(null)

    try {
      const { jobId } = await rfpGenerateMappingPack({ requirements: candidates, vendorContext, company, rfpUnderstanding: oiAssessment })
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

  const hasOI    = !!oiAssessment
  const hasCands = candidates.length > 0
  const hasMap   = mappingRows.length > 0
  const oi       = oiAssessment || {}

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh', color: '#1E293B' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP / RFI Response Manager</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Delivery assessor · Support assessor · Use case assessor · Response prioritisation</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasOI && (
            <button
              onClick={() => exportOIDocx({ oi: oiAssessment, requirements: candidates, company }).catch((e) => setError('Export failed: ' + e.message))}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Export Assessment
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
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Company / Prospect</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp"
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor Context</label>
              <select value={vendorContext} onChange={(e) => setVendorContext(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, background: WHITE }}>
                <option>LogicGate</option><option>Panorays</option><option>Both</option><option>Unknown</option>
              </select>
            </div>
          </div>

          {/* Paste */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 5 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document name</label>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="e.g. Acme RFP"
                  style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={addPasted} disabled={!pasteText.trim()}
                style={{ background: pasteText.trim() ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                + Add
              </button>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste RFP, RFI, scope or supporting content here…" rows={3}
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
            <input ref={fileInputRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html,.rtf"
              style={{ display: 'none' }} onChange={(e) => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button onClick={runOI} disabled={!documents.length || !!loading}
              style={{ background: documents.length && !loading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: documents.length && !loading ? 'pointer' : 'not-allowed' }}>
              {loading === 'oi' ? 'Analysing opportunity…' : '1. Run Opportunity Intelligence Assessment'}
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

        {/* ── Results: Tab bar + content ── */}
        {hasOI && (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, background: WHITE, border: `1px solid ${BORDER}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '11px 22px', fontSize: 13, fontWeight: active ? 700 : 500,
                      border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer',
                      background: active ? NAVY : WHITE,
                      color: active ? WHITE : MUTED,
                      display: 'flex', alignItems: 'center', gap: 6,
                      borderBottom: active ? 'none' : `2px solid transparent`,
                    }}>
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
              {hasMap && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
                  <span style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>✓ Mapping Pack ready</span>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '22px 24px' }}>
              {activeTab === 'usecases'  && <TabUseCases oi={oi} />}
              {activeTab === 'delivery'  && <TabDelivery oi={oi} />}
              {activeTab === 'support'   && <TabSupport oi={oi} />}
              {activeTab === 'workbench' && <TabWorkbench oi={oi} candidates={candidates} />}
            </div>
          </>
        )}

        {/* ── Mapping Pack (below tabs) ── */}
        {hasMap && (
          <MappingPackSection
            mappingRows={mappingRows}
            mappingSummary={mappingSummary}
            oiAssessment={oiAssessment}
            vendorContext={vendorContext}
            company={company}
            onUpdate={updateMappingRow}
            onRegen={regenerateRow}
            regenRow={regenRow}
          />
        )}
      </div>
    </div>
  )
}

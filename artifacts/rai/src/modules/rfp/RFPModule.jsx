import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, ShadingType,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpUploadFiles, rfpStoreText, rfpRemoveDocument,
  rfpAnalyse, rfpGetJob, rfpSectionBrief, rfpDraftSection,
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

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: color.bg, color: color.text, whiteSpace: 'nowrap' }}>{label}</span>
}

function BulletList({ items, color = '#1E293B', emptyText = '—' }) {
  if (!items?.length) return <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>{emptyText}</span>
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
  return <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{children}</div>
}

function ProgressBar({ progress }) {
  if (!progress) return null
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 5
  return (
    <div style={{ marginTop: 10 }}>
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

// ── Owner + priority badges ───────────────────────────────────────────────────
function ownerBadge(owner) {
  if (owner === 'RR')        return { bg: '#DBEAFE', text: BLUE }
  if (owner === 'LogicGate') return { bg: '#F3E8FF', text: PURPLE }
  if (owner === 'Joint')     return { bg: '#D1FAE5', text: '#065F46' }
  return { bg: '#F1F5F9', text: MUTED }
}
function priorityBadge(p) {
  if (p === 'High')   return { bg: '#FEE2E2', text: RED }
  if (p === 'Medium') return { bg: '#FEF9C3', text: AMBER }
  return { bg: '#F1F5F9', text: MUTED }
}
function impactBadge(p) {
  if (p === 'High')   return { bg: '#FEE2E2', text: RED }
  if (p === 'Medium') return { bg: '#FEF9C3', text: AMBER }
  return { bg: '#F1F5F9', text: MUTED }
}

// ── DOCX export ───────────────────────────────────────────────────────────────
const TBORDERS = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left:   { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right:  { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH:{ style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV:{ style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}
function clean(t) { return t ? String(t).replace(/\n/g, ' ').trim() : '' }
function dH(text) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: '0B1F3A' },
    children: [new TextRun({ text: `  ${clean(text)}`, bold: true, color: 'FFFFFF', font: 'Calibri', size: 24 })],
  })
}
function dPara(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}
function dBullet(text) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { after: 60, line: 260 },
    children: [new TextRun({ text: clean(text), font: 'Calibri', size: 22, color: '1E293B' })],
  })
}
function dSpacer() { return new Paragraph({ children: [new TextRun('')], spacing: { before: 60, after: 60 } }) }
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

async function exportSectionDocx({ company, section, draftText, assumptions, vendorInputs }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const children = []

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE, spacing: { after: 160 },
    children: [new TextRun({ text: 'RFP Response Draft', font: 'Calibri', size: 48, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: company || 'Unknown', font: 'Calibri', size: 32, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `Prepared by Risk Rising  ·  ${today}`, font: 'Calibri', size: 22, color: '64748B' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: 'DRAFT — FOR INTERNAL REVIEW ONLY', font: 'Calibri', size: 20, bold: true, color: 'DC2626' })],
  }))
  children.push(dSpacer())

  children.push(dH(`${section.section_ref ? section.section_ref + ' — ' : ''}${section.title}`))
  children.push(dSpacer())

  // Question
  if (section.question_text) {
    children.push(new Paragraph({
      spacing: { before: 80, after: 80 },
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      children: [new TextRun({ text: `Question: ${clean(section.question_text)}`, font: 'Calibri', size: 20, color: '64748B', italics: true })],
    }))
    children.push(dSpacer())
  }

  // Draft response — split by newlines into paragraphs
  const paras = (draftText || '').split(/\n+/).filter(p => p.trim())
  for (const p of paras) {
    children.push(dPara(p))
  }
  children.push(dSpacer())

  // Assumptions
  if (assumptions?.length) {
    children.push(dH('Assumptions'))
    assumptions.forEach(a => children.push(dBullet(a)))
    children.push(dSpacer())
  }

  // Vendor inputs
  if (vendorInputs?.length) {
    children.push(dH('Vendor Inputs Required'))
    vendorInputs.forEach(v => children.push(dBullet(v)))
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const slug = (company || 'RR').replace(/\s+/g, '-')
  const sectionSlug = (section.section_ref || section.title || 'Section').replace(/[\s.]+/g, '-')
  saveAs(blob, `RR-Response-${slug}-${sectionSlug}-${new Date().toISOString().slice(0, 10)}.docx`)
}

async function exportAllDocx({ company, sections, sectionData }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const drafted = sections.filter(s => sectionData[s.id]?.draftText?.trim())
  if (!drafted.length) return

  const children = []
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE, spacing: { after: 160 },
    children: [new TextRun({ text: 'RFP Response Draft', font: 'Calibri', size: 48, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: company || 'Unknown', font: 'Calibri', size: 32, bold: true, color: '0B1F3A' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `Prepared by Risk Rising  ·  ${today}`, font: 'Calibri', size: 22, color: '64748B' })],
  }))
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: 'DRAFT — FOR INTERNAL REVIEW ONLY', font: 'Calibri', size: 20, bold: true, color: 'DC2626' })],
  }))

  for (const section of drafted) {
    const sd = sectionData[section.id]
    children.push(dSpacer())
    children.push(dH(`${section.section_ref ? section.section_ref + ' — ' : ''}${section.title}`))
    children.push(dSpacer())
    const paras = (sd.draftText || '').split(/\n+/).filter(p => p.trim())
    for (const p of paras) children.push(dPara(p))
    if (sd.assumptions?.length) {
      children.push(dSpacer())
      children.push(new Paragraph({ children: [new TextRun({ text: 'Assumptions', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' })] }))
      sd.assumptions.forEach(a => children.push(dBullet(a)))
    }
    if (sd.vendorInputs?.length) {
      children.push(dSpacer())
      children.push(new Paragraph({ children: [new TextRun({ text: 'Vendor Inputs Required', bold: true, font: 'Calibri', size: 22, color: '0B1F3A' })] }))
      sd.vendorInputs.forEach(v => children.push(dBullet(v)))
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `RR-Response-Full-${(company || 'RR').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`)
}

// ── Intelligence Summary panels ───────────────────────────────────────────────
function SummaryPanel({ title, icon, accent, children }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent || NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
      </div>
      <div style={{ padding: '12px 14px', flex: 1 }}>{children}</div>
    </div>
  )
}

function IntelligenceSummary({ summary, company }) {
  if (!summary) return null
  const dates    = summary.key_dates            || []
  const criteria = summary.evaluation_criteria  || []
  const subReqs  = summary.submission_requirements || []
  const consts   = summary.key_constraints      || []
  const rrAreas  = summary.rr_response_areas    || []
  const lgAreas  = summary.logicgate_response_areas || []
  const openQs   = summary.open_questions       || []
  const risks    = summary.key_risks            || []

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>RFP Intelligence Summary</div>
        {company && <span style={{ fontSize: 11, color: MUTED }}>{company}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Key Dates */}
        <SummaryPanel title="Key Dates" icon="📅" accent={RED}>
          {dates.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>No dates identified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dates.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: RED, minWidth: 120, flexShrink: 0 }}>{d.label}</span>
                  <span style={{ color: NAVY, fontWeight: 600 }}>{d.date}</span>
                  {d.note && <span style={{ color: MUTED, fontSize: 11 }}>· {d.note}</span>}
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

        {/* Evaluation Criteria */}
        <SummaryPanel title="Evaluation Criteria" icon="⚖️" accent={AMBER}>
          {criteria.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Not specified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {criteria.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                  <span style={{ flex: 1, color: '#1E293B' }}>{c.criterion}</span>
                  {c.weight && <span style={{ fontWeight: 700, color: AMBER, fontSize: 11, whiteSpace: 'nowrap' }}>{c.weight}</span>}
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

        {/* Submission Requirements */}
        <SummaryPanel title="Submission Requirements" icon="📐" accent={TEAL}>
          <BulletList items={subReqs} color={TEAL} emptyText="Not specified" />
        </SummaryPanel>

        {/* Key Constraints */}
        <SummaryPanel title="Key Constraints" icon="⛔" accent={PURPLE}>
          <BulletList items={consts} color={PURPLE} emptyText="None identified" />
        </SummaryPanel>

        {/* RR Response Areas */}
        <SummaryPanel title="RR Response Areas" icon="🏗️" accent={BLUE}>
          {rrAreas.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rrAreas.map((r, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: BLUE }}>{r.topic}</span>
                  {r.why && <span style={{ color: MUTED }}> — {r.why}</span>}
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

        {/* LogicGate Response Areas */}
        <SummaryPanel title="LogicGate Response Areas" icon="🔷" accent={PURPLE}>
          {lgAreas.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lgAreas.map((r, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: PURPLE }}>{r.topic}</span>
                  {r.why && <span style={{ color: MUTED }}> — {r.why}</span>}
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

        {/* Open Questions */}
        <SummaryPanel title="Open Questions" icon="❓" accent={AMBER}>
          {openQs.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {openQs.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12 }}>
                  <span style={{ color: AMBER, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ color: '#1E293B' }}>{q}</span>
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

        {/* Key Risks */}
        <SummaryPanel title="Key Risks" icon="⚠️" accent={RED}>
          {risks.length === 0 ? <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>None identified</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {risks.map((r, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#1E293B', flex: 1 }}>{r.risk}</span>
                    <Badge label={r.impact || 'Medium'} color={impactBadge(r.impact)} />
                  </div>
                  {r.action && <div style={{ color: MUTED, fontSize: 11 }}>→ {r.action}</div>}
                </div>
              ))}
            </div>
          )}
        </SummaryPanel>

      </div>
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ section, sd, company, vendorContext, intelligenceSummary, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [exporting, setExporting] = useState(false)

  const hasBrief = !!sd?.brief
  const hasDraft = !!sd?.draftText

  async function generateBrief() {
    onUpdate(section.id, { briefLoading: true })
    try {
      const { brief } = await rfpSectionBrief({ section, intelligenceSummary, company, vendorContext })
      onUpdate(section.id, { brief, briefLoading: false })
    } catch (e) {
      onUpdate(section.id, { briefError: e.message, briefLoading: false })
    }
  }

  async function generateDraft() {
    onUpdate(section.id, { draftLoading: true })
    try {
      const result = await rfpDraftSection({ section, brief: sd.brief, company, vendorContext })
      onUpdate(section.id, {
        draftText: result.draft || '',
        assumptions: result.assumptions || [],
        vendorInputs: result.vendor_inputs_needed || [],
        draftLoading: false,
      })
    } catch (e) {
      onUpdate(section.id, { draftError: e.message, draftLoading: false })
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportSectionDocx({ company, section, draftText: sd.draftText, assumptions: sd.assumptions, vendorInputs: sd.vendorInputs })
    } catch {}
    setExporting(false)
  }

  const oc = ownerBadge(section.owner)
  const pc = priorityBadge(section.priority)

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      {/* Card header */}
      <button onClick={() => setExpanded(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {section.section_ref && (
          <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
            {section.section_ref}
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, flex: 1, lineHeight: 1.3 }}>{section.title}</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <Badge label={section.owner || 'RR'} color={oc} />
          <Badge label={section.priority || 'Medium'} color={pc} />
          {hasDraft && <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>✓ Drafted</span>}
          {hasBrief && !hasDraft && <span style={{ fontSize: 10, color: BLUE, fontWeight: 700 }}>· Briefed</span>}
          <span style={{ fontSize: 11, color: MUTED }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px' }}>

          {/* Question text */}
          {section.question_text && (
            <div style={{ background: '#FAFBFC', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1E293B', lineHeight: 1.6, fontStyle: 'italic' }}>
              {section.question_text}
            </div>
          )}
          {section.notes && <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>Note: {section.notes}</div>}

          {/* Brief section */}
          {!hasBrief && (
            <button onClick={generateBrief} disabled={sd?.briefLoading}
              style={{ background: sd?.briefLoading ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: sd?.briefLoading ? 'not-allowed' : 'pointer', marginBottom: 10 }}>
              {sd?.briefLoading ? '⏳ Generating brief…' : '→ Generate Section Brief'}
            </button>
          )}
          {sd?.briefError && <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>{sd.briefError}</div>}

          {hasBrief && (
            <div style={{ background: '#F0FDF4', border: `1px solid #BBF7D0`, borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Response Brief</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>What they want</div>
                  <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{sd.brief.what_they_want}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>What good looks like</div>
                  <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{sd.brief.what_good_looks_like}</div>
                </div>
                {sd.brief.key_points_to_cover?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Key points to cover</div>
                    <BulletList items={sd.brief.key_points_to_cover} color={GREEN} />
                  </div>
                )}
                {sd.brief.evidence_and_examples?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Evidence & examples</div>
                    <BulletList items={sd.brief.evidence_and_examples} color={BLUE} />
                  </div>
                )}
                {sd.brief.pitfalls_to_avoid?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 3 }}>Pitfalls to avoid</div>
                    <BulletList items={sd.brief.pitfalls_to_avoid} color={RED} />
                  </div>
                )}
                {sd.brief.suggested_word_count && (
                  <div style={{ fontSize: 11, color: MUTED }}>Suggested word count: ~{sd.brief.suggested_word_count} words</div>
                )}
              </div>
            </div>
          )}

          {/* Draft section */}
          {hasBrief && !hasDraft && (
            <button onClick={generateDraft} disabled={sd?.draftLoading}
              style={{ background: sd?.draftLoading ? '#CBD5E1' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: sd?.draftLoading ? 'not-allowed' : 'pointer', marginBottom: 10 }}>
              {sd?.draftLoading ? '⏳ Drafting response…' : '✦ Generate Draft Response'}
            </button>
          )}
          {sd?.draftError && <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>{sd.draftError}</div>}

          {hasDraft && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Draft Response</div>
              <textarea
                value={sd.draftText}
                onChange={e => onUpdate(section.id, { draftText: e.target.value })}
                rows={Math.max(8, (sd.draftText?.split('\n').length || 0) + 2)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', color: '#1E293B' }}
              />

              {sd.assumptions?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, textTransform: 'uppercase', marginBottom: 4 }}>Assumptions</div>
                  <BulletList items={sd.assumptions} color={AMBER} />
                </div>
              )}
              {sd.vendorInputs?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', marginBottom: 4 }}>Vendor Inputs Required</div>
                  <BulletList items={sd.vendorInputs} color={PURPLE} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={handleExport} disabled={exporting}
                  style={{ background: exporting ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer' }}>
                  {exporting ? 'Exporting…' : '⬇ Export Section to Word'}
                </button>
                <button onClick={generateDraft} disabled={sd?.draftLoading}
                  style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                  ↺ Regenerate
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RFPModule({ onBack }) {
  const [company, setCompany]             = useState('')
  const [vendorContext, setVendorContext]  = useState('LogicGate')
  const [documents, setDocuments]         = useState([])
  const [uploading, setUploading]         = useState(false)
  const [pasteText, setPasteText]         = useState('')
  const [pasteName, setPasteName]         = useState('')

  const [jobId, setJobId]                 = useState(null)
  const [polling, setPolling]             = useState(false)
  const [progress, setProgress]           = useState(null)

  const [intelligenceSummary, setSummary] = useState(null)
  const [responseSections, setSections]   = useState([])
  const [sectionData, setSectionData]     = useState({})

  const [setupCollapsed, setSetupCollapsed] = useState(false)
  const [error, setError]                 = useState(null)
  const [exporting, setExporting]         = useState(false)

  const fileInputRef = useRef(null)

  // ── Polling ──
  useEffect(() => {
    if (!jobId || !polling) return
    const timer = setInterval(async () => {
      try {
        const job = await rfpGetJob(jobId)
        if (job.progress) setProgress(job.progress)
        if (job.status === 'done') {
          setSummary(job.intelligenceSummary || null)
          setSections(job.responseSections || [])
          setPolling(false)
          setSetupCollapsed(true)
        } else if (job.status === 'error') {
          setError(job.error || 'Analysis failed')
          setPolling(false)
        }
      } catch (e) {
        setError(e.message)
        setPolling(false)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [jobId, polling])

  // ── Upload ──
  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      const { files: results } = await rfpUploadFiles(fd)
      const ok = results.filter(r => r.id)
      const errs = results.filter(r => r.error)
      if (errs.length) setError(errs.map(e => `${e.name}: ${e.error}`).join('\n'))
      setDocuments(p => [...p, ...ok])
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  function handleDrop(e) { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)) }
  function handleDragOver(e) { e.preventDefault() }

  async function addPasted() {
    if (!pasteText.trim()) return
    setUploading(true); setError(null)
    try {
      const entry = await rfpStoreText({ name: pasteName.trim() || 'Pasted document', text: pasteText.trim() })
      setDocuments(p => [...p, entry])
      setPasteText(''); setPasteName('')
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  // ── Analysis ──
  async function runAnalysis() {
    if (!documents.length || polling) return
    setError(null); setSummary(null); setSections([]); setSectionData({}); setProgress(null)
    try {
      const { jobId: jid } = await rfpAnalyse({ documentIds: documents.map(d => d.id), vendorContext, company: company.trim() || 'Unknown' })
      setJobId(jid); setPolling(true)
      setProgress({ done: 0, total: 3, stage: 'Starting analysis…' })
    } catch (e) { setError(e.message) }
  }

  // ── Section data updates ──
  function updateSection(id, patch) {
    setSectionData(p => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }))
  }

  // ── Reset ──
  function resetAll() {
    documents.forEach(d => rfpRemoveDocument(d.id).catch(() => {}))
    setDocuments([]); setSummary(null); setSections([]); setSectionData({})
    setJobId(null); setPolling(false); setProgress(null); setError(null)
    setSetupCollapsed(false)
  }

  const hasResults = !!intelligenceSummary
  const draftedCount = Object.values(sectionData).filter(sd => sd?.draftText?.trim()).length

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 14, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          ← RAI Home
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP / RFI Workbench</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Understand · Assess · Respond</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {draftedCount > 0 && (
            <button onClick={async () => {
              setExporting(true)
              try { await exportAllDocx({ company: company || 'Unknown', sections: responseSections, sectionData }) } catch {}
              setExporting(false)
            }} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 6, color: WHITE, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {exporting ? 'Exporting…' : `⬇ Export All (${draftedCount} sections)`}
            </button>
          )}
          {hasResults && (
            <button onClick={resetAll} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
              New analysis
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Setup Card ── */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 20, overflow: 'hidden' }}>
          {setupCollapsed ? (
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setSetupCollapsed(false)}>
              <span style={{ fontSize: 11, color: MUTED }}>📁 {documents.length} document{documents.length !== 1 ? 's' : ''} · {company || 'No company'} · {vendorContext}</span>
              <button style={{ marginLeft: 'auto', fontSize: 11, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit ▼</button>
            </div>
          ) : (
            <div style={{ padding: '18px 22px' }}>
              {/* Company + vendor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Company / Prospect</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Marks & Spencer"
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor Context</label>
                  <select value={vendorContext} onChange={e => setVendorContext(e.target.value)}
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
                    <input value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder="e.g. M&S RFP"
                      style={{ width: '100%', padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={addPasted} disabled={!pasteText.trim() || uploading}
                    style={{ background: pasteText.trim() && !uploading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() && !uploading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                    + Add
                  </button>
                </div>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste RFP content, scope documents, procurement instructions, requirements…" rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
              </div>

              {/* Drop zone */}
              <div onDrop={handleDrop} onDragOver={handleDragOver}
                style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px', marginBottom: documents.length ? 10 : 0, background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{uploading ? '⏳' : '📎'}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{uploading ? 'Uploading…' : 'Drop files here — Word, PDF, Excel, text'}</span>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Browse</button>
                <input ref={fileInputRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.html,.rtf"
                  style={{ display: 'none' }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
              </div>

              {/* Document chips */}
              {documents.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14 }}>
                  {documents.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EAF1F8', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                      <span>{d.fileType === 'excel' ? '📊' : '📄'}</span>
                      <span>{d.name}</span>
                      {d.rowCount ? <span style={{ color: MUTED, fontSize: 10 }}>({d.rowCount} rows)</span>
                        : d.charCount ? <span style={{ color: MUTED, fontSize: 10 }}>({Math.round(d.charCount / 1000)}k chars)</span> : null}
                      <button onClick={() => { rfpRemoveDocument(d.id); setDocuments(p => p.filter(x => x.id !== d.id)) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, padding: 0, marginLeft: 2 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              {polling && progress && <ProgressBar progress={progress} />}

              {/* CTA */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                <button onClick={runAnalysis} disabled={!documents.length || polling}
                  style={{ background: documents.length && !polling ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: documents.length && !polling ? 'pointer' : 'not-allowed' }}>
                  {polling ? 'Analysing…' : '→ Generate Intelligence Summary'}
                </button>
                {!documents.length && <span style={{ fontSize: 12, color: MUTED }}>Upload or paste RFP documents first</span>}
              </div>

              {error && (
                <div style={{ marginTop: 10, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{error}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Intelligence Summary ── */}
        {hasResults && (
          <IntelligenceSummary summary={intelligenceSummary} company={company} />
        )}

        {/* ── Response Sections ── */}
        {responseSections.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
                Response Sections
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: MUTED }}>
                  {responseSections.length} sections · {draftedCount} drafted
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['RR', 'LogicGate', 'Joint'].map(owner => {
                  const count = responseSections.filter(s => s.owner === owner).length
                  if (!count) return null
                  return <Badge key={owner} label={`${owner}: ${count}`} color={ownerBadge(owner)} />
                })}
              </div>
            </div>

            {/* Sort: High first */}
            {[...responseSections]
              .sort((a, b) => {
                const order = { High: 0, Medium: 1, Low: 2 }
                return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
              })
              .map(section => (
                <SectionCard
                  key={section.id}
                  section={section}
                  sd={sectionData[section.id] || {}}
                  company={company}
                  vendorContext={vendorContext}
                  intelligenceSummary={intelligenceSummary}
                  onUpdate={updateSection}
                />
              ))
            }
          </div>
        )}

        {/* Empty state */}
        {!hasResults && !polling && !documents.length && (
          <div style={{ textAlign: 'center', padding: '60px 40px', color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 8 }}>RFP / RFI Workbench</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              Upload your RFP documents, generate an intelligence summary, then draft responses section by section.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  rfpUploadFiles, rfpStoreText, rfpRemoveDocument,
  rfpCreatePack, rfpGetPack, rfpDetectSections,
  rfpExtractBrief, rfpGenerateDraft, rfpUpdateDraft, rfpAdvanceDraftStatus,
} from './api.js'

// ── Brand palette (UI) ────────────────────────────────────────────────────────
const NAVY   = '#0B1F3A'
const BLUE   = '#1D4ED8'
const GREEN  = '#16A34A'
const AMBER  = '#D97706'
const RED    = '#DC2626'
const PURPLE = '#7C3AED'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const WHITE  = '#FFFFFF'
const BG     = '#F8FAFC'

// Brand palette for docx export (per spec)
const DOC_NAVY   = '06095A'
const DOC_PURPLE = '3205B3'
const DOC_CYAN   = '13D4DB'
const DOC_LCYAN  = 'E7FAFB'
const DOC_GRAY   = '64748B'

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ label, color = { bg: '#F1F5F9', text: MUTED } }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: color.bg, color: color.text }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    draft:     { label: 'DRAFT',     bg: '#FEF9C3', text: AMBER },
    in_review: { label: 'IN REVIEW', bg: '#DBEAFE', text: BLUE },
    approved:  { label: 'APPROVED',  bg: '#D1FAE5', text: GREEN },
  }
  const c = map[status] || map.draft
  return <Badge label={c.label} color={{ bg: c.bg, text: c.text }} />
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
}

// ── Word export ───────────────────────────────────────────────────────────────
const TBORDERS = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  left:   { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  right:  { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideH:{ style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideV:{ style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
}
function clean(t) { return t ? String(t).replace(/\n{3,}/g, '\n\n').trim() : '' }
function dPara(text, options = {}) {
  const { bold = false, color = '1F2937', size = 22, spacing = 80 } = options
  return new Paragraph({
    spacing: { after: spacing, line: 276 },
    children: [new TextRun({ text: clean(text), font: 'Arial', size, bold, color })]
  })
}
function dBullet(text) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { after: 60, line: 260 },
    children: [new TextRun({ text: clean(text), font: 'Arial', size: 22, color: '1F2937' })]
  })
}
function dSpacer() { return new Paragraph({ children: [new TextRun('')], spacing: { before: 80, after: 80 } }) }
function dCompHeader(id, label) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: DOC_NAVY },
    children: [new TextRun({ text: `  ${id}. ${label}`, font: 'Arial', size: 24, bold: true, color: 'FFFFFF' })]
  })
}
function dCallout(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: DOC_LCYAN },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        borders: {
          left: { style: BorderStyle.THICK, size: 12, color: DOC_CYAN },
          top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL },
        },
        children: [new Paragraph({ children: [new TextRun({ text: clean(text), font: 'Arial', size: 20, color: DOC_NAVY, italics: true })] })]
      })
    ]})]
  })
}

// Parse risks content into structured rows for table rendering
function parseRisksForTable(content) {
  const lines = content.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const rows = []
  for (const line of lines) {
    if (line.toLowerCase().startsWith('risk:') || line.includes('|')) {
      // Try to parse "Risk: ... | L×I: ... | Mitigation: ... | Owner: ..."
      const parts = line.split('|').map(p => p.trim())
      if (parts.length >= 2) {
        rows.push(parts)
      }
    }
  }
  return rows
}

function dRisksTable(content) {
  const rows = parseRisksForTable(content)
  if (!rows.length) {
    return content.split(/\n+/).filter(l => l.trim()).map(l => dBullet(l))
  }
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: ['Risk', 'L×I', 'Mitigation', 'Owner'].map(h => new TableCell({
        shading: { type: ShadingType.CLEAR, fill: DOC_NAVY },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, font: 'Arial', size: 20, bold: true, color: 'FFFFFF' })] })]
      }))
    }),
    ...rows.map((parts, i) => new TableRow({
      children: Array.from({ length: 4 }, (_, j) => new TableCell({
        shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: clean(parts[j] ?? ''), font: 'Arial', size: 20, color: '1F2937' })] })]
      }))
    }))
  ]
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows })
}

function dPlaceholderBanner(count) {
  return dCallout(`⚠ ${count} placeholder${count !== 1 ? 's' : ''} still require human input before this section is ready for release.`)
}

async function exportSectionDocx({ buyer, sectionCode, sectionTitle, status, components }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const children = []

  // Unfilled placeholder count
  const unfilledCount = components.reduce((n, c) => {
    return n + (c.content.match(/\{\{PLACEHOLDER:/g) || []).length
  }, 0)

  // Cover
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: 'RFP Response — Commercial Lens', font: 'Arial', size: 44, bold: true, color: DOC_NAVY })]
  }))
  children.push(dPara(buyer, { size: 32, bold: true, color: DOC_NAVY, spacing: 80 }))
  children.push(dPara(`Section ${sectionCode}: ${sectionTitle}`, { size: 26, color: DOC_PURPLE, spacing: 60 }))
  children.push(dPara(`Prepared by Risk Rising · ${today}`, { size: 20, color: DOC_GRAY, spacing: 40 }))
  children.push(dPara('DRAFT — FOR INTERNAL REVIEW ONLY. NOT APPROVED FOR RELEASE.', { size: 20, bold: true, color: 'DC2626', spacing: 120 }))
  children.push(dPara('Commercial lens — this output is for internal bid preparation only. It must not be used as, or feed, independent analyst content, white papers, or public thought leadership.', { size: 18, color: DOC_GRAY, spacing: 40 }))

  if (unfilledCount > 0) {
    children.push(dSpacer())
    children.push(dPlaceholderBanner(unfilledCount))
  }

  // 12 components
  for (const comp of components) {
    children.push(dSpacer())
    children.push(dCompHeader(comp.id, comp.label))
    if (comp.id === 12) {
      // Risks — special table
      const el = dRisksTable(comp.content)
      if (Array.isArray(el)) { for (const p of el) children.push(p) }
      else children.push(el)
    } else if ([9, 8].includes(comp.id)) {
      // Assumptions, Pre-work — callout box
      children.push(dCallout(comp.content))
    } else {
      // Regular paragraphs
      const paras = comp.content.split(/\n+/).filter(p => p.trim())
      for (const p of paras) children.push(dPara(p))
    }
  }

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Commercial lens — Risk Rising internal draft   ', font: 'Arial', size: 18, color: DOC_GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: DOC_GRAY }),
      ]
    })]
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        }
      },
      footers: { default: footer },
      children,
    }]
  })

  try {
    const blob = await Packer.toBlob(doc)
    const slug = `${buyer || 'RR'}-S${sectionCode}`.replace(/[\s.]+/g, '-')
    saveAs(blob, `RR-${slug}-${new Date().toISOString().slice(0, 10)}.docx`)
  } catch (err) {
    throw new Error(`Word export failed: ${err.message}`)
  }
}

// ── Placeholder utilities ─────────────────────────────────────────────────────
function detectPlaceholders(components) {
  const seen = new Set()
  const result = []
  for (const comp of components) {
    const matches = [...(comp.content || '').matchAll(/\{\{PLACEHOLDER:\s*([^}]+?)\}\}/g)]
    for (const m of matches) {
      const key = m[1].trim()
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ key, placeholder: m[0], context: comp.label, value: '' })
      }
    }
  }
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SetupScreen({ onPack }) {
  const [buyer, setBuyer]         = useState('')
  const [packName, setPackName]   = useState('')
  const [documents, setDocuments] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [error, setError]         = useState(null)
  const fileInputRef = useRef(null)

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

  async function create() {
    if (!documents.length || creating) return
    setCreating(true); setError(null)
    try {
      const pack = await rfpCreatePack({ name: packName.trim() || 'Bid Pack', buyer: buyer.trim() || 'Unknown', documentIds: documents.map(d => d.id) })
      onPack(pack)
    } catch (e) { setError(e.message); setCreating(false) }
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 6 }}>New Bid Pack</div>
        <div style={{ fontSize: 13, color: MUTED }}>Upload the RFP files, then RRAI will identify the scored sections and help you draft each response.</div>
      </div>

      {/* Buyer + pack name */}
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '18px 22px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer / Organisation</label>
            <input value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="e.g. Marks & Spencer"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pack Name</label>
            <input value={packName} onChange={e => setPackName(e.target.value)} placeholder="e.g. M&S GRC RFP 2026"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Paste */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: NAVY, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paste document text</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 5 }}>
            <input value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder="Document name"
              style={{ flex: 1, padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
            <button onClick={addPasted} disabled={!pasteText.trim() || uploading}
              style={{ background: pasteText.trim() && !uploading ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: pasteText.trim() && !uploading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3}
            placeholder="Paste RFP content, evaluation framework, scope, or procurement instructions…"
            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
        </div>

        {/* Drop zone */}
        <div onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: `1px dashed ${BORDER}`, borderRadius: 6, padding: '10px 16px', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 10, marginBottom: documents.length ? 10 : 0 }}>
          <span style={{ fontSize: 15 }}>{uploading ? '⏳' : '📎'}</span>
          <span style={{ fontSize: 12, color: MUTED }}>{uploading ? 'Uploading…' : 'Drop files — PDF, Word, Excel, text'}</span>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ marginLeft: 'auto', fontSize: 11, color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Browse</button>
          <input ref={fileInputRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md"
            style={{ display: 'none' }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
        </div>

        {/* Document chips */}
        {documents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
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
  const [sections, setSections]           = useState(pack.sections || [])
  const [detecting, setDetecting]         = useState(false)
  const [briefLoading, setBriefLoading]   = useState(null)  // sectionId
  const [draftLoading, setDraftLoading]   = useState(null)  // sectionId
  const [expanded, setExpanded]           = useState(null)  // sectionId
  const [error, setError]                 = useState(null)

  useEffect(() => {
    // Auto-detect sections if none detected yet
    if (!sections.length) detect()
  }, [])

  async function detect() {
    setDetecting(true); setError(null)
    try {
      const { sections: s } = await rfpDetectSections(pack.id)
      setSections(s || [])
    } catch (e) { setError(e.message) }
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
    try {
      const { draft } = await rfpGenerateDraft(section.id)
      onDraft({ ...section, draft })
    } catch (e) { setError(e.message); setDraftLoading(null) }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{pack.buyer}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{pack.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={detect} disabled={detecting}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
            ↺ Re-detect
          </button>
          <button onClick={onReset}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
            + New pack
          </button>
        </div>
      </div>

      {detecting && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>🔍 Detecting scored response sections…</div>
          <div style={{ fontSize: 11 }}>Reading the procurement documents to identify every section requiring a written response.</div>
        </div>
      )}

      {error && <div style={{ marginBottom: 12, color: RED, fontSize: 12, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

      {!detecting && sections.length === 0 && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, textAlign: 'center', color: MUTED }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No scored sections detected.</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>This can happen if the document contains mostly administrative content or tick-box requirements. Try re-detecting or paste the RFP's scored questions section directly.</div>
          <button onClick={detect} style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↺ Try again</button>
        </div>
      )}

      {sections.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            {sections.length} scored section{sections.length !== 1 ? 's' : ''} detected — extract a brief for each section, then generate the draft response.
          </div>
          {sections.map(section => {
            const isExpanded = expanded === section.id
            const briefExtracted = section.briefStatus === 'extracted'
            const isBriefLoading = briefLoading === section.id
            const isDraftLoading = draftLoading === section.id
            const hasDraft = !!section.draft

            return (
              <div key={section.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: NAVY, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{section.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, flex: 1 }}>{section.title}</span>
                  {section.scoringWeight && <Badge label={section.scoringWeight} color={{ bg: '#FEF9C3', text: AMBER }} />}
                  {hasDraft && <Badge label="Drafted" color={{ bg: '#D1FAE5', text: GREEN }} />}
                  {briefExtracted && !hasDraft && <Badge label="Brief ready" color={{ bg: '#DBEAFE', text: BLUE }} />}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {!briefExtracted && !isBriefLoading && (
                      <button onClick={() => extractBrief(section)}
                        style={{ background: NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Extract brief
                      </button>
                    )}
                    {isBriefLoading && (
                      <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <Spinner /> Extracting…
                      </button>
                    )}
                    {briefExtracted && !isDraftLoading && (
                      <>
                        <button onClick={() => setExpanded(isExpanded ? null : section.id)}
                          style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: MUTED, cursor: 'pointer' }}>
                          {isExpanded ? 'Hide brief' : 'View brief'}
                        </button>
                        <button onClick={() => startDraft(section)}
                          style={{ background: GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {hasDraft ? 'Open draft →' : 'Generate draft →'}
                        </button>
                      </>
                    )}
                    {isDraftLoading && (
                      <button disabled style={{ background: '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <Spinner /> Drafting…
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {section.summary && !isExpanded && (
                  <div style={{ padding: '0 16px 12px', fontSize: 12, color: MUTED }}>{section.summary}</div>
                )}

                {/* Expanded brief */}
                {isExpanded && briefExtracted && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', background: '#FAFBFC' }}>
                    {section.scoringWeight && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, textTransform: 'uppercase', marginBottom: 3 }}>Scoring weight</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: AMBER }}>{section.scoringWeight}</div>
                      </div>
                    )}
                    {section.requirements?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', marginBottom: 4 }}>Requirements ({section.requirements.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {section.requirements.map((r, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#1E293B', display: 'flex', gap: 8, lineHeight: 1.5 }}>
                              <span style={{ color: BLUE, flexShrink: 0 }}>{i + 1}.</span><span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {section.constraints?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', marginBottom: 4 }}>Constraints</div>
                        {section.constraints.map((c, i) => <div key={i} style={{ fontSize: 12, color: '#1E293B', marginBottom: 2 }}>• {c}</div>)}
                      </div>
                    )}
                    {section.mandatedStructure?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', marginBottom: 4 }}>Mandated structure</div>
                        {section.mandatedStructure.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#1E293B', marginBottom: 2 }}>• {s}</div>)}
                      </div>
                    )}
                    {section.evaluationNotes && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Evaluation notes</div>
                        <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5, fontStyle: 'italic' }}>{section.evaluationNotes}</div>
                      </div>
                    )}
                    <div style={{ marginTop: 14 }}>
                      <button onClick={() => startDraft(section)} disabled={isDraftLoading}
                        style={{ background: isDraftLoading ? '#CBD5E1' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: isDraftLoading ? 'not-allowed' : 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isDraftLoading ? <><Spinner /> Drafting…</> : '✦ Generate 12-Part Draft Response →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Draft screen ──────────────────────────────────────────────────────────────
function DraftScreen({ section, buyer, packId, onBack }) {
  const [components, setComponents]         = useState(section.draft?.components || [])
  const [placeholderValues, setPhValues]    = useState({})
  const [status, setStatus]                 = useState(section.draft?.status || 'draft')
  const [saving, setSaving]                 = useState(false)
  const [advancing, setAdvancing]           = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [exportError, setExportError]       = useState(null)
  const [dirty, setDirty]                   = useState(false)

  const placeholders = detectPlaceholders(components)
  const unfilledCount = placeholders.filter(p => !placeholderValues[p.key]).length

  function updateComponent(id, content) {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, content } : c))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await rfpUpdateDraft(section.id, { components })
      setDirty(false)
    } catch (e) {
      // Silent fail — content is still in local state
    }
    setSaving(false)
  }

  async function advance() {
    if (dirty) await save()
    setAdvancing(true)
    try {
      const { draft } = await rfpAdvanceDraftStatus(section.id)
      setStatus(draft.status)
    } catch (e) {}
    setAdvancing(false)
  }

  function applyPlaceholder(key, placeholder, value) {
    if (!value.trim()) return
    setComponents(prev => prev.map(c => ({ ...c, content: c.content.split(placeholder).join(value) })))
    setDirty(true)
  }

  async function doExport() {
    if (dirty) await save()
    setExporting(true); setExportError(null)
    try {
      await exportSectionDocx({ buyer, sectionCode: section.code, sectionTitle: section.title, status, components })
    } catch (e) { setExportError(e.message) }
    finally { setExporting(false) }
  }

  const statusLabel = { draft: 'Mark Ready for Review', in_review: 'Approve Response', approved: '' }
  const canAdvance = status !== 'approved'

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {/* Draft header */}
      <div style={{ background: NAVY, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          ← Sections
        </button>
        <span style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>{section.code} — {section.title}</span>
        {section.scoringWeight && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{section.scoringWeight}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={status} />
          {dirty && (
            <button onClick={save} disabled={saving}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: WHITE, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ background: '#FEF9C3', borderBottom: `1px solid ${AMBER}`, padding: '6px 24px', fontSize: 11, color: AMBER, fontWeight: 600 }}>
        ⚠ Commercial lens — internal draft only. Not approved for release. Human sign-off required before export.
      </div>

      <div style={{ display: 'flex', gap: 0, maxWidth: 1400, margin: '0 auto' }}>

        {/* Left: 12 components */}
        <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
          {components.map(comp => (
            <div key={comp.id} style={{ marginBottom: 20 }}>
              <div style={{ background: NAVY, color: WHITE, padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 700 }}>
                {comp.id}. {comp.label}
              </div>
              <textarea
                value={comp.content}
                onChange={e => updateComponent(comp.id, e.target.value)}
                rows={Math.max(4, (comp.content?.split('\n').length || 0) + 1)}
                style={{
                  width: '100%', padding: '10px 14px',
                  border: `1px solid ${BORDER}`, borderTop: 'none',
                  borderRadius: '0 0 6px 6px', fontSize: 13,
                  fontFamily: 'Georgia, serif', lineHeight: 1.7,
                  resize: 'vertical', boxSizing: 'border-box', color: '#1E293B',
                  background: comp.content?.includes('{{PLACEHOLDER:') ? '#FFFBEB' : WHITE,
                }}
              />
            </div>
          ))}
        </div>

        {/* Right: placeholder checklist + actions */}
        <div style={{ width: 300, flexShrink: 0, padding: '20px 20px 20px 0' }}>
          <div style={{ position: 'sticky', top: 20 }}>
            {/* Placeholder checklist */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Placeholders
                </div>
                <div style={{ fontSize: 11, color: unfilledCount > 0 ? AMBER : GREEN, marginTop: 2, fontWeight: 600 }}>
                  {unfilledCount > 0 ? `${unfilledCount} require input` : '✓ All filled'}
                </div>
              </div>
              <div style={{ padding: '10px 14px', maxHeight: 420, overflowY: 'auto' }}>
                {placeholders.length === 0 && (
                  <div style={{ fontSize: 12, color: GREEN, fontStyle: 'italic' }}>No placeholders found</div>
                )}
                {placeholders.map(ph => {
                  const filled = !!placeholderValues[ph.key]?.trim()
                  return (
                    <div key={ph.key} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: filled ? GREEN : AMBER, textTransform: 'uppercase', marginBottom: 2 }}>
                        {filled ? '✓' : '○'} {ph.key}
                      </div>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>in {ph.context}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          value={placeholderValues[ph.key] || ''}
                          onChange={e => setPhValues(p => ({ ...p, [ph.key]: e.target.value }))}
                          placeholder="Enter value…"
                          style={{ flex: 1, padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, minWidth: 0 }}
                        />
                        <button onClick={() => applyPlaceholder(ph.key, ph.placeholder, placeholderValues[ph.key] || '')}
                          disabled={!placeholderValues[ph.key]?.trim()}
                          style={{ background: placeholderValues[ph.key]?.trim() ? BLUE : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 4, padding: '5px 8px', fontSize: 10, fontWeight: 700, cursor: placeholderValues[ph.key]?.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                          Apply
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status flow */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                <StatusBadge status={status} />
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                {status === 'draft' && 'Fill all placeholders and edit components. When satisfied, mark ready for review.'}
                {status === 'in_review' && 'Under review. Approve when all content has been confirmed by a human reviewer.'}
                {status === 'approved' && 'Approved. Ready for export. The .docx will include all current content.'}
              </div>
              {canAdvance && (
                <button onClick={advance} disabled={advancing}
                  style={{ width: '100%', background: advancing ? '#CBD5E1' : (status === 'in_review' ? GREEN : BLUE), color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: advancing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  {advancing ? <><Spinner /> Updating…</> : statusLabel[status]}
                </button>
              )}
              {status === 'approved' && (
                <>
                  <button onClick={doExport} disabled={exporting}
                    style={{ width: '100%', background: exporting ? '#CBD5E1' : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {exporting ? <><Spinner /> Generating…</> : '⬇ Export to .docx'}
                  </button>
                  {exportError && <div style={{ marginTop: 8, color: RED, fontSize: 11 }}>{exportError}</div>}
                </>
              )}
              {status !== 'approved' && unfilledCount > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: AMBER, background: '#FEF9C3', padding: '6px 10px', borderRadius: 6 }}>
                  {unfilledCount} placeholder{unfilledCount !== 1 ? 's' : ''} still unfilled. Fill before approving.
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

// ── Main module ───────────────────────────────────────────────────────────────
export default function RFPModule({ onBack }) {
  const [screen, setScreen]           = useState('setup')   // 'setup' | 'sections' | 'draft'
  const [pack, setPack]               = useState(null)
  const [activeSection, setSection]   = useState(null)

  function handlePack(pack) { setPack(pack); setScreen('sections') }
  function handleDraft(section) { setSection(section); setScreen('draft') }
  function handleBackToSections() { setSection(null); setScreen('sections') }
  function handleReset() { setPack(null); setSection(null); setScreen('setup') }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      {/* Shared header (hidden in draft screen — draft has its own) */}
      {screen !== 'draft' && (
        <div style={{ background: NAVY, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            ← RAI Home
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>RFP Response Drafter</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Commercial lens</span>
          {pack && screen === 'sections' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>/ {pack.buyer}</span>
          )}
        </div>
      )}

      {screen === 'setup' && <SetupScreen onPack={handlePack} />}
      {screen === 'sections' && pack && (
        <SectionsScreen pack={pack} onDraft={handleDraft} onReset={handleReset} />
      )}
      {screen === 'draft' && activeSection && pack && (
        <DraftScreen section={activeSection} buyer={pack.buyer} packId={pack.id} onBack={handleBackToSections} />
      )}
    </div>
  )
}

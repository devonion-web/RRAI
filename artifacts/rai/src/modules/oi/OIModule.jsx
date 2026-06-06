import React, { useState, useEffect, useRef, useCallback } from 'react'
import { oiList, oiCreate, oiGet, oiDelete, oiPatch, oiEnrich } from './api.js'

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

// ── Section definitions ───────────────────────────────────────────────────────
const SECTIONS = [
  {
    key: 'customer', label: 'Customer', icon: '🏢', accent: NAVY,
    fields: [
      { key: 'name',          label: 'Name' },
      { key: 'industry',      label: 'Industry' },
      { key: 'geography',     label: 'Geography' },
      { key: 'stakeholders',  label: 'Stakeholders' },
      { key: 'sponsors',      label: 'Sponsors' },
    ],
  },
  {
    key: 'objectives', label: 'Objectives', icon: '🎯', accent: BLUE,
    fields: [
      { key: 'business_objectives', label: 'Business Objectives' },
      { key: 'drivers',             label: 'Drivers' },
      { key: 'challenges',          label: 'Challenges' },
      { key: 'desired_outcomes',    label: 'Desired Outcomes' },
    ],
  },
  {
    key: 'use_cases', label: 'Use Cases', icon: '📋', accent: TEAL,
    fields: [
      { key: 'risk_management',    label: 'Risk Management' },
      { key: 'controls',           label: 'Controls' },
      { key: 'audit',              label: 'Internal Audit' },
      { key: 'tprm',               label: 'TPRM' },
      { key: 'compliance',         label: 'Compliance' },
      { key: 'policy',             label: 'Policy' },
      { key: 'incident_management',label: 'Incident Management' },
      { key: 'reporting',          label: 'Reporting' },
      { key: 'workflow',           label: 'Workflow' },
      { key: 'other',              label: 'Other' },
    ],
  },
  {
    key: 'solution', label: 'Solution', icon: '🔷', accent: PURPLE,
    fields: [
      { key: 'logicgate_modules',       label: 'LogicGate Modules' },
      { key: 'vendor_components',       label: 'Vendor Components' },
      { key: 'integrations',            label: 'Integrations' },
      { key: 'reporting_requirements',  label: 'Reporting Requirements' },
      { key: 'data_model_requirements', label: 'Data Model Requirements' },
    ],
  },
  {
    key: 'delivery', label: 'Delivery', icon: '🏗️', accent: '#0369A1',
    fields: [
      { key: 'discovery_requirements',      label: 'Discovery' },
      { key: 'configuration_requirements',  label: 'Configuration' },
      { key: 'migration_requirements',      label: 'Migration' },
      { key: 'integration_requirements',    label: 'Integration' },
      { key: 'testing_requirements',        label: 'Testing' },
      { key: 'training_requirements',       label: 'Training' },
    ],
  },
  {
    key: 'support', label: 'Support', icon: '🛎️', accent: GREEN,
    fields: [
      { key: 'hypercare_requirements',       label: 'Hypercare' },
      { key: 'managed_service_opportunities',label: 'Managed Service' },
      { key: 'support_coverage',             label: 'Support Coverage' },
      { key: 'administrative_support',       label: 'Admin Support' },
      { key: 'geographic_considerations',    label: 'Geographic' },
    ],
  },
  {
    key: 'commercial', label: 'Commercial', icon: '💼', accent: AMBER,
    fields: [
      { key: 'constraints',                    label: 'Constraints' },
      { key: 'assumptions',                    label: 'Assumptions' },
      { key: 'contractual_considerations',     label: 'Contractual' },
      { key: 'delivery_complexity_indicators', label: 'Complexity Indicators' },
    ],
  },
  {
    key: 'risks', label: 'Risks', icon: '⚠️', accent: RED,
    fields: [
      { key: 'delivery_risks',    label: 'Delivery' },
      { key: 'integration_risks', label: 'Integration' },
      { key: 'resource_risks',    label: 'Resource' },
      { key: 'dependency_risks',  label: 'Dependency' },
    ],
  },
  {
    key: 'response_areas', label: 'Response Areas', icon: '📬', accent: '#BE185D',
    fields: [
      { key: 'rr_response_required',          label: 'RR Must Answer' },
      { key: 'logicgate_validation_required', label: 'LG Must Validate' },
      { key: 'joint_response_required',       label: 'Joint Response' },
    ],
  },
]

// ── Coverage helpers ──────────────────────────────────────────────────────────
function coverageColor(pct) {
  if (pct >= 85) return { bar: GREEN,  bg: '#D1FAE5', text: GREEN }
  if (pct >= 60) return { bar: BLUE,   bg: '#DBEAFE', text: BLUE }
  if (pct >= 30) return { bar: AMBER,  bg: '#FEF9C3', text: AMBER }
  return               { bar: RED,    bg: '#FEE2E2', text: RED }
}

function sectionCoverage(model, sectionDef) {
  if (!model) return { populated: 0, total: sectionDef.fields.length }
  const sectionData = model[sectionDef.key] || {}
  const populated = sectionDef.fields.filter(f => {
    const arr = sectionData[f.key]
    return Array.isArray(arr) && arr.length > 0
  }).length
  return { populated, total: sectionDef.fields.length }
}

// ── Small atoms ───────────────────────────────────────────────────────────────
function ConfBadge({ v }) {
  const c = v === 'High' ? { bg: '#D1FAE5', text: GREEN } : v === 'Medium' ? { bg: '#FEF9C3', text: AMBER } : { bg: '#FEE2E2', text: RED }
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>{v}</span>
}
function ExplicitBadge({ v }) {
  const c = v === 'Explicit' ? { bg: '#EFF6FF', text: BLUE } : { bg: '#F5F3FF', text: PURPLE }
  return <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>{v}</span>
}
function SourceChip({ doc, section }) {
  return (
    <span title={`${doc}${section ? ` — ${section}` : ''}`}
      style={{ fontSize: 9, color: MUTED, background: '#F1F5F9', padding: '1px 6px', borderRadius: 8, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}>
      📄 {doc}{section ? ` · ${section}` : ''}
    </span>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, items, accent }) {
  const [expanded, setExpanded] = useState(false)
  const isEmpty = !items || items.length === 0
  const display = expanded ? items : (items || []).slice(0, 2)

  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${BORDER}`, alignItems: 'flex-start', minHeight: 34 }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: 11, fontWeight: 600, color: MUTED, paddingTop: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEmpty ? (
          <span style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {display.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5, flex: 1, minWidth: 0 }}>{item.value}</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  <ConfBadge v={item.confidence} />
                  <ExplicitBadge v={item.explicit_or_inferred} />
                  <SourceChip doc={item.source_document} section={item.source_section} />
                </div>
              </div>
            ))}
            {items.length > 2 && (
              <button onClick={() => setExpanded(p => !p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: accent || BLUE, fontWeight: 600, textAlign: 'left', padding: 0 }}>
                {expanded ? '▲ Show less' : `▼ +${items.length - 2} more`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ def, model, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const sectionData = model?.[def.key] || {}
  const { populated, total } = sectionCoverage(model, def)
  const pct = Math.round((populated / total) * 100)
  const cc = coverageColor(pct)

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 26, height: 26, borderRadius: 6, background: def.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{def.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, flex: 1 }}>{def.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: cc.text, background: cc.bg, padding: '2px 8px', borderRadius: 12 }}>
            {populated}/{total}
          </span>
          <span style={{ fontSize: 9, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0 16px 8px 16px' }}>
          {def.fields.map(f => (
            <FieldRow key={f.key} label={f.label} items={sectionData[f.key]} accent={def.accent} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Coverage bar ──────────────────────────────────────────────────────────────
function CoverageBar({ pct }) {
  const cc = coverageColor(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: cc.bar, borderRadius: 3, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: cc.text, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── Enrich panel ──────────────────────────────────────────────────────────────
function EnrichPanel({ opportunityId, onDone, vendorContext }) {
  const [content, setContent]       = useState('')
  const [docName, setDocName]       = useState('')
  const [vc, setVc]                 = useState(vendorContext || 'LogicGate')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const fileRef                     = useRef(null)

  async function handleEnrich() {
    if (!content.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await oiEnrich(opportunityId, content.trim(), docName || 'Document', vc)
      setResult(data.fieldsAdded)
      setContent('')
      setDocName('')
      onDone(data.model)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleFile(file) {
    if (!file) return
    const text = await file.text()
    setContent(text)
    if (!docName) setDocName(file.name)
  }

  return (
    <div style={{ background: '#F0FDF4', border: `1px solid #BBF7D0`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>✦</span> Enrich Intelligence Model
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Document Name</label>
          <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Acme RFP, Discovery Notes"
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Vendor Context</label>
          <select value={vc} onChange={e => setVc(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: WHITE }}>
            <option>LogicGate</option><option>Panorays</option><option>Both</option><option>Unknown</option>
          </select>
        </div>
      </div>

      <textarea value={content} onChange={e => setContent(e.target.value)}
        placeholder="Paste any document — RFP, RFI, discovery pack, workshop notes, BRD, security questionnaire, email thread…"
        rows={5}
        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, marginBottom: 10 }} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleEnrich} disabled={!content.trim() || loading}
          style={{ background: !content.trim() || loading ? '#CBD5E1' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: !content.trim() || loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Enriching…' : '✦ Enrich Model'}
        </button>
        <button onClick={() => fileRef.current?.click()}
          style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 14px', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
          📎 Upload file
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.docx,.pdf,.html,.rtf,.csv" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
        {result !== null && <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>✓ {result} field{result !== 1 ? 's' : ''} added</span>}
        {error && <span style={{ fontSize: 12, color: RED }}>{error}</span>}
      </div>
    </div>
  )
}

// ── Enrichment log ────────────────────────────────────────────────────────────
function EnrichmentLog({ log }) {
  if (!log || !log.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Enrichment History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {log.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontWeight: 600, color: NAVY }}>{entry.document_name}</span>
            <span style={{ color: MUTED }}>+{entry.fields_added} fields</span>
            <span style={{ color: '#CBD5E1', fontSize: 10, marginLeft: 'auto' }}>
              {new Date(entry.enriched_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Opportunity list item ─────────────────────────────────────────────────────
function OppListItem({ opp, active, onClick, onDelete }) {
  const cc = coverageColor(opp.coverage_pct)
  return (
    <div onClick={onClick}
      style={{ padding: '10px 14px', cursor: 'pointer', background: active ? LBLUE : 'transparent', borderLeft: active ? `3px solid ${NAVY}` : '3px solid transparent', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: NAVY, flex: 1, lineHeight: 1.3 }}>{opp.company}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 13, padding: 0, marginLeft: 6, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: cc.bar, width: `${opp.coverage_pct}%` }} />
        </div>
        <span style={{ fontSize: 10, color: cc.text, fontWeight: 600, minWidth: 28 }}>{opp.coverage_pct}%</span>
      </div>
      {opp.enrichment_log?.length > 0 && (
        <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{opp.enrichment_log.length} enrichment{opp.enrichment_log.length !== 1 ? 's' : ''}</div>
      )}
    </div>
  )
}

// ── Opportunity detail view ───────────────────────────────────────────────────
function OppDetail({ model, onUpdate }) {
  const [showEnrich, setShowEnrich] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(model.company)

  async function saveName() {
    if (nameDraft.trim() && nameDraft !== model.company) {
      try {
        await oiPatch(model.id, { company: nameDraft.trim() })
        onUpdate({ ...model, company: nameDraft.trim() })
      } catch {}
    }
    setEditingName(false)
  }

  const cc = coverageColor(model.coverage_pct)

  return (
    <div>
      {/* Company header */}
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditingName(false); setNameDraft(model.company) } }}
                style={{ fontSize: 20, fontWeight: 700, color: NAVY, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', fontFamily: 'inherit' }} />
              <button onClick={saveName} style={{ fontSize: 11, color: GREEN, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setEditingName(false); setNameDraft(model.company) }} style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: NAVY }}>{model.company}</h2>
              <button onClick={() => setEditingName(true)} style={{ fontSize: 10, color: MUTED, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>Edit</button>
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: MUTED }}>Model coverage</span>
            <div style={{ flex: 1, maxWidth: 200 }}><CoverageBar pct={model.coverage_pct} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEnrich(p => !p)}
            style={{ background: showEnrich ? GREEN : NAVY, color: WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {showEnrich ? '▲ Close' : '✦ Enrich Model'}
          </button>
        </div>
      </div>

      {/* Enrich panel */}
      {showEnrich && (
        <EnrichPanel
          opportunityId={model.id}
          vendorContext='LogicGate'
          onDone={updated => { onUpdate(updated); }}
        />
      )}

      {/* Enrichment history */}
      {model.enrichment_log?.length > 0 && (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
          <EnrichmentLog log={model.enrichment_log} />
        </div>
      )}

      {/* Section layout — 2 columns where possible */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Customer — col 1 */}
        <SectionCard def={SECTIONS[0]} model={model} defaultOpen={true} />
        {/* Objectives — col 2 */}
        <SectionCard def={SECTIONS[1]} model={model} defaultOpen={true} />
        {/* Use Cases — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <SectionCard def={SECTIONS[2]} model={model} defaultOpen={true} />
        </div>
        {/* Solution — col 1 */}
        <SectionCard def={SECTIONS[3]} model={model} defaultOpen={true} />
        {/* Delivery — col 2 */}
        <SectionCard def={SECTIONS[4]} model={model} defaultOpen={true} />
        {/* Support — col 1 */}
        <SectionCard def={SECTIONS[5]} model={model} defaultOpen={true} />
        {/* Commercial — col 2 */}
        <SectionCard def={SECTIONS[6]} model={model} defaultOpen={true} />
        {/* Risks — col 1 */}
        <SectionCard def={SECTIONS[7]} model={model} defaultOpen={true} />
        {/* Response Areas — col 2 */}
        <SectionCard def={SECTIONS[8]} model={model} defaultOpen={true} />
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onCreate }) {
  const [name, setName] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🧠</div>
      <h2 style={{ margin: '0 0 10px', color: NAVY, fontSize: 22, fontWeight: 700 }}>Opportunity Intelligence</h2>
      <p style={{ color: MUTED, fontSize: 14, maxWidth: 400, lineHeight: 1.6, margin: '0 0 28px' }}>
        Create a living intelligence model for each opportunity. Enrich it from RFPs, discovery packs, workshop notes, security questionnaires and more.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onCreate(name.trim())}
          placeholder="Company / opportunity name"
          style={{ padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, width: 220 }} />
        <button onClick={() => name.trim() && onCreate(name.trim())} disabled={!name.trim()}
          style={{ background: name.trim() ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
          Create
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OIModule({ onBack }) {
  const [opportunities, setOpportunities] = useState([])
  const [selected, setSelected]           = useState(null)
  const [loading, setLoading]             = useState(true)
  const [newName, setNewName]             = useState('')
  const [creating, setCreating]           = useState(false)

  const loadList = useCallback(async () => {
    try {
      const data = await oiList()
      setOpportunities(data.opportunities || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  async function handleCreate(company) {
    setCreating(true)
    try {
      const model = await oiCreate(company || newName)
      setOpportunities(p => [model, ...p])
      setSelected(model)
      setNewName('')
    } catch {}
    finally { setCreating(false) }
  }

  async function handleDelete(id) {
    try {
      await oiDelete(id)
      setOpportunities(p => p.filter(o => o.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch {}
  }

  function handleUpdate(updatedModel) {
    setOpportunities(p => p.map(o => o.id === updatedModel.id ? updatedModel : o))
    setSelected(updatedModel)
  }

  async function handleSelect(opp) {
    try {
      const fresh = await oiGet(opp.id)
      setSelected(fresh)
    } catch {
      setSelected(opp)
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, height: 52, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, color: WHITE, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ← RAI Home
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>Opportunity Intelligence</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Single source of truth for every opportunity</span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 260, flexShrink: 0, background: WHITE, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          {/* New opportunity input */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newName.trim() && handleCreate()}
                placeholder="New opportunity…"
                style={{ flex: 1, padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, minWidth: 0 }} />
              <button onClick={() => handleCreate()} disabled={!newName.trim() || creating}
                style={{ background: newName.trim() && !creating ? NAVY : '#CBD5E1', color: WHITE, border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: newName.trim() && !creating ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                +
              </button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 12 }}>Loading…</div>
          ) : opportunities.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 12 }}>No opportunities yet</div>
          ) : (
            opportunities.map(opp => (
              <OppListItem key={opp.id} opp={opp} active={selected?.id === opp.id}
                onClick={() => handleSelect(opp)}
                onDelete={() => handleDelete(opp.id)} />
            ))
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: selected ? '20px 24px' : 0, display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <OppDetail model={selected} onUpdate={handleUpdate} />
          ) : (
            <EmptyState onCreate={handleCreate} />
          )}
        </div>
      </div>
    </div>
  )
}

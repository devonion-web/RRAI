import React, { useState, useEffect } from 'react'

/*
 * ============================================================================
 * Development Lens — Phase 1 (UI shell + live task data)
 * ----------------------------------------------------------------------------
 * Administrator-only module.
 *   - Roadmap tab: fetches and displays live development_tasks from the API.
 *   - All other tabs: placeholder cards (future phases).
 *
 * Design language: inline styles, Inter, the shared navy/slate palette.
 * Rendered beneath the standard "← RAI Home" back bar provided by App.tsx.
 * ============================================================================
 */

const NAVY = '#0B1F3A'
const BLUE = '#1D4ED8'
const MUTED = '#64748B'
const BORDER = '#E2E8F0'
const WHITE = '#FFFFFF'
const BG = '#F8FAFC'
const SUBTLE = '#F1F5F9'
const GREEN = '#16A34A'
const AMBER = '#D97706'
const RED = '#DC2626'

export const DEVELOPMENT_TABS = [
  { key: 'architecture', label: 'Architecture' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'github', label: 'GitHub' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'build', label: 'Build Status' },
]

const TAB_CONTENT = {
  architecture: {
    intro:
      'Structural view of the RAI platform. Later phases will populate live architecture maps, component registries and data-model views here.',
    cards: [
      { icon: '▤', title: 'System Architecture Map', summary: 'Runtime elements, dependencies and enforcement boundaries.' },
      { icon: '◧', title: 'Component Registry', summary: 'Catalogue of platform components and their owners.' },
      { icon: '▦', title: 'Data Model & Schema', summary: 'Entities, relationships and the Drizzle schema overview.' },
      { icon: '◈', title: 'Integration Topology', summary: 'Internal interfaces and future external integrations.' },
    ],
  },
  knowledge: {
    intro:
      'Oversight of the governed Knowledge Store. Later phases will surface indexing, governance state and coverage gaps.',
    cards: [
      { icon: '▣', title: 'Knowledge Store Index', summary: 'Governed, authored, versioned assets at a glance.' },
      { icon: '✎', title: 'Governance Status', summary: 'Review-gate state and pending knowledge changes.' },
      { icon: '◔', title: 'Coverage & Gaps', summary: 'Domains well covered vs. thin or missing.' },
    ],
  },
  engineering: {
    intro:
      'Engineering health of the platform. Later phases will populate services, environments, dependencies and technical debt.',
    cards: [
      { icon: '⚙', title: 'Services & Modules', summary: 'App, API and worker modules and their status.' },
      { icon: '◫', title: 'Environment Config', summary: 'Environments and non-secret configuration overview.' },
      { icon: '◇', title: 'Dependencies', summary: 'Key libraries and their currency.' },
      { icon: '▲', title: 'Technical Debt Register', summary: 'Known debt items awaiting prioritisation.' },
    ],
  },
  github: {
    intro:
      'Source-control overview. Not connected in Phase 1 — these cards are placeholders only; no GitHub integration is wired up yet.',
    cards: [
      { icon: '◐', title: 'Repository Overview', summary: 'Repo summary. Connection arrives in a later phase.', tag: 'Not connected' },
      { icon: '⤴', title: 'Open Pull Requests', summary: 'PR list placeholder — no data source yet.', tag: 'Not connected' },
      { icon: '◷', title: 'Recent Commits', summary: 'Commit history placeholder — no data source yet.', tag: 'Not connected' },
      { icon: '⑂', title: 'Branch Status', summary: 'Branch / ahead-behind placeholder — no data source yet.', tag: 'Not connected' },
    ],
  },
  reviews: {
    intro:
      'Review and decision trail. Later phases will populate code reviews, architecture reviews and design decisions.',
    cards: [
      { icon: '◎', title: 'Code Reviews', summary: 'Recent and pending review activity.' },
      { icon: '▥', title: 'Architecture Reviews', summary: 'Reviews against the platform architecture.' },
      { icon: '✦', title: 'Design Decisions (ADRs)', summary: 'Recorded architecture decisions.' },
    ],
  },
  build: {
    intro:
      'Build and deployment status. Later phases will populate pipeline stages, deployments and test results.',
    cards: [
      { icon: '●', title: 'Latest Build', summary: 'Most recent build outcome placeholder.' },
      { icon: '▶', title: 'Pipeline Stages', summary: 'Stage-by-stage pipeline overview.' },
      { icon: '▚', title: 'Deployments', summary: 'Environment deployment history.' },
      { icon: '✓', title: 'Test Results', summary: 'Suite pass / fail summary placeholder.' },
    ],
  },
}

// ── Primitives ────────────────────────────────────────────────────────────────

export function Pill({ children, tone = 'muted' }) {
  const tones = {
    muted:    { bg: SUBTLE,       text: MUTED },
    navy:     { bg: '#EAF1F8',   text: NAVY },
    amber:    { bg: '#FEF3C7',   text: '#92400E' },
    green:    { bg: '#DCFCE7',   text: '#166534' },
    red:      { bg: '#FEE2E2',   text: '#991B1B' },
    blue:     { bg: '#DBEAFE',   text: '#1E40AF' },
  }
  const t = tones[tone] || tones.muted
  return (
    <span style={{
      background: t.bg, color: t.text,
      fontSize: 11, fontWeight: 700,
      padding: '3px 10px', borderRadius: 999,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div role="tablist" aria-label="Development sections" style={{
      display: 'flex', gap: 4,
      borderBottom: `1px solid ${BORDER}`,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <button key={t.key} role="tab" aria-selected={isActive}
            onClick={() => onChange(t.key)}
            style={{
              background: 'none', border: 'none',
              padding: '12px 14px', fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? NAVY : MUTED,
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              borderBottom: `2px solid ${isActive ? NAVY : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function PlaceholderCard({ icon, title, summary, tag = 'Placeholder' }) {
  const tone = tag === 'Not connected' ? 'amber' : 'muted'
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)', height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <span aria-hidden="true" style={{
            width: 30, height: 30, borderRadius: 8,
            background: SUBTLE, color: NAVY,
            display: 'grid', placeItems: 'center',
            fontSize: 15, flexShrink: 0,
          }}>{icon}</span>
        )}
        <span style={{ fontSize: 14.5, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>{title}</span>
        <span style={{ marginLeft: 'auto' }}><Pill tone={tone}>{tag}</Pill></span>
      </div>
      {summary && <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>{summary}</p>}
      <div style={{ marginTop: 'auto', display: 'grid', gap: 6, paddingTop: 6 }}>
        <span style={skeletonRow(88)} />
        <span style={skeletonRow(64)} />
      </div>
    </div>
  )
}

const skeletonRow = (widthPct) => ({
  display: 'block', height: 8,
  width: `${widthPct}%`, borderRadius: 6,
  background: 'repeating-linear-gradient(90deg,#EEF2F7,#EEF2F7 10px,#F6F8FB 10px,#F6F8FB 20px)',
})

export function PlaceholderGrid({ children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16,
    }}>
      {children}
    </div>
  )
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_TONE = {
  proposed:                  'muted',
  approved_to_start:         'blue',
  drafting:                  'blue',
  under_review:              'amber',
  refinement_required:       'amber',
  awaiting_human_approval:   'amber',
  approved:                  'green',
  rejected:                  'red',
  ready_for_implementation:  'blue',
  implemented:               'green',
  verified:                  'green',
  released:                  'green',
  archived:                  'muted',
}

const RISK_TONE = { low: 'green', medium: 'amber', high: 'red', critical: 'red' }

function statusLabel(s) {
  return s.replace(/_/g, ' ')
}

// ── Roadmap tab — live task list ──────────────────────────────────────────────

function TaskCard({ task }) {
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, flex: 1, lineHeight: 1.35 }}>
          {task.title}
        </span>
        <Pill tone={STATUS_TONE[task.status] || 'muted'}>{statusLabel(task.status)}</Pill>
      </div>
      {task.description && (
        <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>
          {task.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
        <Pill tone="navy">{task.taskType}</Pill>
        <Pill tone={RISK_TONE[task.riskLevel] || 'muted'}>{task.riskLevel} risk</Pill>
        {task.assignedRole && <Pill tone="muted">{statusLabel(task.assignedRole)}</Pill>}
      </div>
    </div>
  )
}

function RoadmapTab() {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/development/tasks')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setTasks(data.tasks ?? []))
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA',
        borderRadius: 10, padding: '14px 18px',
        fontSize: 13, color: RED,
      }}>
        Could not load tasks: {error}
      </div>
    )
  }

  if (tasks === null) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {[88, 72, 80].map((w) => (
          <div key={w} style={{
            background: WHITE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '16px 20px', height: 80,
            display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center',
          }}>
            <span style={skeletonRow(w)} />
            <span style={skeletonRow(50)} />
          </div>
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div style={{
        background: WHITE, border: `1px dashed ${BORDER}`,
        borderRadius: 12, padding: '32px 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
          No development tasks yet. Create the first task via the API to populate this view.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}

// ── Module ────────────────────────────────────────────────────────────────────

export default function DevelopmentModule() {
  const [activeTab, setActiveTab] = useState('architecture')
  const active = TAB_CONTENT[activeTab] || activeTab === 'roadmap' ? activeTab : 'architecture'
  const isRoadmap = active === 'roadmap'
  const content = TAB_CONTENT[active]
  const activeLabel = DEVELOPMENT_TABS.find((t) => t.key === active)?.label ?? active

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 30px 64px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 10, flexWrap: 'wrap', marginBottom: 6,
          }}>
            <h1 style={{
              fontSize: 24, fontWeight: 800, color: NAVY,
              margin: 0, letterSpacing: '-0.02em',
            }}>
              Development
            </h1>
            <Pill tone="navy">Admin only</Pill>
            <Pill tone="muted">Phase 1</Pill>
          </div>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            The administrator workspace for platform architecture, engineering, and development governance.
          </p>
        </div>

        <TabBar tabs={DEVELOPMENT_TABS} active={active} onChange={setActiveTab} />

        <div style={{ paddingTop: 22 }}>
          {isRoadmap ? (
            <>
              <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 16px', lineHeight: 1.55 }}>
                Live development tasks from the orchestrator. Create tasks via{' '}
                <code style={{ fontSize: 12, background: SUBTLE, padding: '1px 5px', borderRadius: 4 }}>
                  POST /api/development/tasks
                </code>
                .
              </p>
              <RoadmapTab />
            </>
          ) : content ? (
            <>
              <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 16px', lineHeight: 1.55 }}>
                {content.intro}
              </p>
              <PlaceholderGrid>
                {content.cards.map((card) => (
                  <PlaceholderCard
                    key={card.title}
                    icon={card.icon}
                    title={card.title}
                    summary={card.summary}
                    tag={card.tag || 'Placeholder'}
                  />
                ))}
              </PlaceholderGrid>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

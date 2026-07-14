import React, { useState } from 'react'

/*
 * ============================================================================
 * Development Lens — Phase 1 (UI shell)
 * ----------------------------------------------------------------------------
 * Administrator-only module that establishes the structural shell future
 * architecture will populate. Phase 1 delivers the frame only:
 *   - a tab strip: Architecture · Knowledge · Engineering · GitHub ·
 *     Roadmap · Reviews · Build Status
 *   - placeholder cards inside every tab
 *
 * Deliberately NOT included (per brief):
 *   - No workflow logic
 *   - No hardcoded business logic
 *   - No GitHub connection (the GitHub tab is placeholders only)
 *   - No APIs / data fetching
 *   - No change to any existing module behaviour
 *
 * Design language mirrors the existing RAI modules (RFP / LogicGate):
 * inline styles, Inter, the shared navy/slate palette below. This module is
 * rendered beneath the standard "← RAI Home" back bar provided by App.tsx.
 * ============================================================================
 */

// ── Brand palette (identical to the existing modules) ───────────────────────
const NAVY = '#0B1F3A'
const BLUE = '#1D4ED8'
const MUTED = '#64748B'
const BORDER = '#E2E8F0'
const WHITE = '#FFFFFF'
const BG = '#F8FAFC'
const SUBTLE = '#F1F5F9'

// ── Tab definitions ─────────────────────────────────────────────────────────
export const DEVELOPMENT_TABS = [
  { key: 'architecture', label: 'Architecture' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'github', label: 'GitHub' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'build', label: 'Build Status' },
]

/*
 * Placeholder content per tab. Presentational only — a title plus a one-line
 * note describing what a later phase will populate. No data, no logic, no
 * external calls.
 */
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
  roadmap: {
    intro:
      'Delivery roadmap for the platform. Later phases will populate phases, milestones and backlog themes.',
    cards: [
      { icon: '▭', title: 'Phase Timeline', summary: 'Phased delivery plan overview.' },
      { icon: '◆', title: 'Milestones', summary: 'Upcoming milestones and target windows.' },
      { icon: '☰', title: 'Backlog Themes', summary: 'Grouped themes awaiting shaping.' },
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

// ── Reusable primitives ─────────────────────────────────────────────────────

/** Small pill badge, matching the dashboard/module badge style. */
export function Pill({ children, tone = 'muted' }) {
  const tones = {
    muted: { bg: SUBTLE, text: MUTED },
    navy: { bg: '#EAF1F8', text: NAVY },
    amber: { bg: '#FEF3C7', text: '#92400E' },
  }
  const t = tones[tone] || tones.muted
  return (
    <span
      style={{
        background: t.bg,
        color: t.text,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

/** Horizontal tab strip — navy active underline, scrollable on narrow screens. */
export function TabBar({ tabs, active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Development sections"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${BORDER}`,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? NAVY : MUTED,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
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

/** A single "future architecture will populate this" card. Presentational. */
export function PlaceholderCard({ icon, title, summary, tag = 'Placeholder' }) {
  const tone = tag === 'Not connected' ? 'amber' : 'muted'
  return (
    <div
      style={{
        background: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: SUBTLE,
              color: NAVY,
              display: 'grid',
              placeItems: 'center',
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <span style={{ fontSize: 14.5, fontWeight: 700, color: NAVY, lineHeight: 1.25 }}>
          {title}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Pill tone={tone}>{tag}</Pill>
        </span>
      </div>

      {summary && (
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>{summary}</p>
      )}

      {/* Empty skeleton rows — signal "content coming" without faking data. */}
      <div style={{ marginTop: 'auto', display: 'grid', gap: 6, paddingTop: 6 }}>
        <span style={skeletonRow(88)} />
        <span style={skeletonRow(64)} />
      </div>
    </div>
  )
}

const skeletonRow = (widthPct) => ({
  display: 'block',
  height: 8,
  width: `${widthPct}%`,
  borderRadius: 6,
  background:
    'repeating-linear-gradient(90deg, #EEF2F7, #EEF2F7 10px, #F6F8FB 10px, #F6F8FB 20px)',
})

/** Responsive auto-fill grid of cards. */
export function PlaceholderGrid({ children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {children}
    </div>
  )
}

// ── Module ──────────────────────────────────────────────────────────────────
export default function DevelopmentModule() {
  const [activeTab, setActiveTab] = useState('architecture')
  const active = TAB_CONTENT[activeTab] ? activeTab : 'architecture'
  const content = TAB_CONTENT[active]
  const activeLabel = DEVELOPMENT_TABS.find((t) => t.key === active).label

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: BG, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 30px 64px' }}>
        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 6,
            }}
          >
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: NAVY,
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Development
            </h1>
            <Pill tone="navy">Admin only</Pill>
            <Pill tone="muted">Phase 1 · shell</Pill>
          </div>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            The administrator workspace future architecture will populate. Phase 1 establishes the
            framework only.
          </p>
        </div>

        {/* Tabs */}
        <TabBar tabs={DEVELOPMENT_TABS} active={active} onChange={setActiveTab} />

        {/* Active tab content */}
        <div style={{ paddingTop: 22 }}>
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
        </div>
      </div>
    </div>
  )
}

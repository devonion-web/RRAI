import React, { useState, useEffect } from 'react'

/*
 * ============================================================================
 * Development Lens — Sprint 2 (Overview Dashboard MVP)
 * ----------------------------------------------------------------------------
 * Administrator-only module.
 *   - Overview tab: primary operating dashboard (Platform Health, Next Action,
 *     Waiting For Me, Current Development, Activity Timeline).
 *   - Roadmap tab: live development task list.
 *   - All other tabs: placeholder cards (future phases).
 *
 * Design language: inline styles, Inter, the shared navy/slate palette.
 * No animations. No charts. Cards only.
 * ============================================================================
 */

const NAVY   = '#0B1F3A'
const BLUE   = '#1D4ED8'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const WHITE  = '#FFFFFF'
const BG     = '#F8FAFC'
const SUBTLE = '#F1F5F9'
const GREEN  = '#16A34A'
const AMBER  = '#D97706'
const RED    = '#DC2626'

// ── Tab registry ─────────────────────────────────────────────────────────────

export const DEVELOPMENT_TABS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'roadmap',       label: 'Roadmap' },
  { key: 'architecture',  label: 'Architecture' },
  { key: 'knowledge',     label: 'Knowledge' },
  { key: 'engineering',   label: 'Engineering' },
  { key: 'github',        label: 'GitHub' },
  { key: 'reviews',       label: 'Reviews' },
  { key: 'build',         label: 'Build Status' },
]

// ── Static placeholder tab content ───────────────────────────────────────────

const TAB_CONTENT = {
  architecture: {
    intro: 'Structural view of the RAI platform. Later phases will populate live architecture maps, component registries and data-model views here.',
    cards: [
      { icon: '▤', title: 'System Architecture Map',   summary: 'Runtime elements, dependencies and enforcement boundaries.' },
      { icon: '◧', title: 'Component Registry',        summary: 'Catalogue of platform components and their owners.' },
      { icon: '▦', title: 'Data Model & Schema',       summary: 'Entities, relationships and the Drizzle schema overview.' },
      { icon: '◈', title: 'Integration Topology',      summary: 'Internal interfaces and future external integrations.' },
    ],
  },
  knowledge: {
    intro: 'Oversight of the governed Knowledge Store. Later phases will surface indexing, governance state and coverage gaps.',
    cards: [
      { icon: '▣', title: 'Knowledge Store Index', summary: 'Governed, authored, versioned assets at a glance.' },
      { icon: '✎', title: 'Governance Status',     summary: 'Review-gate state and pending knowledge changes.' },
      { icon: '◔', title: 'Coverage & Gaps',       summary: 'Domains well covered vs. thin or missing.' },
    ],
  },
  engineering: {
    intro: 'Engineering health of the platform. Later phases will populate services, environments, dependencies and technical debt.',
    cards: [
      { icon: '⚙', title: 'Services & Modules',       summary: 'App, API and worker modules and their status.' },
      { icon: '◫', title: 'Environment Config',        summary: 'Environments and non-secret configuration overview.' },
      { icon: '◇', title: 'Dependencies',              summary: 'Key libraries and their currency.' },
      { icon: '▲', title: 'Technical Debt Register',   summary: 'Known debt items awaiting prioritisation.' },
    ],
  },
  github: {
    intro: 'Source-control overview. Not connected in Phase 1 — these cards are placeholders only.',
    cards: [
      { icon: '◐', title: 'Repository Overview',  summary: 'Repo summary. Connection arrives in a later phase.',       tag: 'Not connected' },
      { icon: '⤴', title: 'Open Pull Requests',   summary: 'PR list placeholder — no data source yet.',                tag: 'Not connected' },
      { icon: '◷', title: 'Recent Commits',        summary: 'Commit history placeholder — no data source yet.',         tag: 'Not connected' },
      { icon: '⑂', title: 'Branch Status',         summary: 'Branch / ahead-behind placeholder — no data source yet.', tag: 'Not connected' },
    ],
  },
  reviews: {
    intro: 'Review and decision trail. Later phases will populate code reviews, architecture reviews and design decisions.',
    cards: [
      { icon: '◎', title: 'Code Reviews',              summary: 'Recent and pending review activity.' },
      { icon: '▥', title: 'Architecture Reviews',      summary: 'Reviews against the platform architecture.' },
      { icon: '✦', title: 'Design Decisions (ADRs)',    summary: 'Recorded architecture decisions.' },
    ],
  },
  build: {
    intro: 'Build and deployment status. Later phases will populate pipeline stages, deployments and test results.',
    cards: [
      { icon: '●', title: 'Latest Build',       summary: 'Most recent build outcome placeholder.' },
      { icon: '▶', title: 'Pipeline Stages',    summary: 'Stage-by-stage pipeline overview.' },
      { icon: '▚', title: 'Deployments',         summary: 'Environment deployment history.' },
      { icon: '✓', title: 'Test Results',        summary: 'Suite pass / fail summary placeholder.' },
    ],
  },
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_TONE = {
  proposed:                'muted',
  approved_to_start:       'blue',
  drafting:                'blue',
  under_review:            'amber',
  refinement_required:     'amber',
  awaiting_human_approval: 'amber',
  approved:                'green',
  rejected:                'red',
  ready_for_implementation:'blue',
  implemented:             'green',
  verified:                'green',
  released:                'green',
  archived:                'muted',
}

const RISK_TONE = { low: 'green', medium: 'amber', high: 'red', critical: 'red' }

function statusLabel(s) {
  return s.replace(/_/g, ' ')
}

function healthTone(status) {
  if (status === 'Implemented')    return 'green'
  if (status === 'Partial')        return 'amber'
  if (status === 'Not connected')  return 'muted'
  return 'muted'
}

function healthDot(status) {
  if (status === 'Implemented')    return { bg: '#DCFCE7', fg: '#16A34A' }
  if (status === 'Partial')        return { bg: '#FEF3C7', fg: '#D97706' }
  if (status === 'Not connected')  return { bg: SUBTLE,   fg: MUTED }
  return { bg: SUBTLE, fg: MUTED }
}

function priorityTone(p) {
  if (p === 'high')   return 'red'
  if (p === 'medium') return 'amber'
  return 'muted'
}

function eventIcon(type) {
  if (type === 'task_created')   return '+'
  if (type === 'task_updated')   return '↻'
  if (type?.includes('approval')) return '✓'
  if (type?.includes('finding')) return '!'
  if (type?.includes('branch'))  return '⑂'
  if (type?.includes('build'))   return '▶'
  return '·'
}

// ── Low-level primitives ──────────────────────────────────────────────────────

export function Pill({ children, tone = 'muted' }) {
  const tones = {
    muted:  { bg: SUBTLE,      text: MUTED },
    navy:   { bg: '#EAF1F8',   text: NAVY },
    amber:  { bg: '#FEF3C7',   text: '#92400E' },
    green:  { bg: '#DCFCE7',   text: '#166534' },
    red:    { bg: '#FEE2E2',   text: '#991B1B' },
    blue:   { bg: '#DBEAFE',   text: '#1E40AF' },
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

const skeletonRow = (widthPct) => ({
  display: 'block', height: 8,
  width: `${widthPct}%`, borderRadius: 6,
  background: 'repeating-linear-gradient(90deg,#EEF2F7,#EEF2F7 10px,#F6F8FB 10px,#F6F8FB 20px)',
})

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

// ── Data hooks ────────────────────────────────────────────────────────────────

function usePlatformStatus() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/development/platform-status')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  return { data, loading, error }
}

function useActivity() {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/development/activity')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setEvents(d.events ?? []); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  return { events, loading, error }
}

function useTasks() {
  const [tasks, setTasks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/development/tasks')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setTasks(d.tasks ?? []); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  return { tasks, loading, error }
}

// ── Shared primitives for dashboard ──────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: MUTED,
      margin: '0 0 12px',
    }}>
      {children}
    </h2>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{
      background: WHITE, border: `1px dashed ${BORDER}`,
      borderRadius: 10, padding: '24px 20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{message}</p>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA',
      borderRadius: 10, padding: '12px 16px',
      fontSize: 13, color: RED,
    }}>
      {message}
    </div>
  )
}

function SkeletonCard({ height = 90 }) {
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: 20, height,
      display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center',
    }}>
      <span style={skeletonRow(72)} />
      <span style={skeletonRow(48)} />
    </div>
  )
}

// ── 1. Platform Health ────────────────────────────────────────────────────────

function HealthCard({ area, status, summary, lastEvaluated }) {
  const dot = healthDot(status)
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: dot.fg, flexShrink: 0,
        }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, flex: 1 }}>{area}</span>
        <Pill tone={healthTone(status)}>{status}</Pill>
      </div>
      <p style={{ fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.55 }}>{summary}</p>
      {lastEvaluated && lastEvaluated !== 'N/A' && (
        <p style={{ fontSize: 11.5, color: '#94A3B8', margin: 0 }}>
          Evaluated: {lastEvaluated}
        </p>
      )}
    </div>
  )
}

function PlatformHealthSection({ health, loading, error }) {
  return (
    <section>
      <SectionHeading>Platform Health</SectionHeading>
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6,7].map((n) => <SkeletonCard key={n} height={88} />)}
        </div>
      )}
      {!loading && error && (
        <ErrorBanner message={`Could not load platform health: ${error}`} />
      )}
      {!loading && !error && (!health || health.length === 0) && (
        <EmptyState message="No health data available. Run: pnpm --filter @workspace/scripts run generate:platform-status" />
      )}
      {!loading && !error && health && health.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {health.map((h) => (
            <HealthCard
              key={h.area}
              area={h.area}
              status={h.status}
              summary={h.summary}
              lastEvaluated={h.lastEvaluated}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── 2. Recommended Next Action ────────────────────────────────────────────────

function NextActionCard({ action, loading, error, onOpenRoadmap }) {
  return (
    <section style={{ flex: '1 1 320px', minWidth: 0 }}>
      <SectionHeading>Recommended Next Action</SectionHeading>
      {loading && <SkeletonCard height={140} />}
      {!loading && error && (
        <ErrorBanner message={`Could not load next action: ${error}`} />
      )}
      {!loading && !error && !action && (
        <EmptyState message="No recommendation available. Generate platform status to populate this." />
      )}
      {!loading && !error && action && (
        <div style={{
          background: WHITE, border: `2px solid ${BORDER}`,
          borderRadius: 12, padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: NAVY, flex: 1, lineHeight: 1.3 }}>
              {action.title}
            </span>
          </div>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            {action.reason}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill tone={priorityTone(action.priority)}>{action.priority} priority</Pill>
            <Pill tone="navy">{action.effort}</Pill>
            <button
              onClick={onOpenRoadmap}
              style={{
                marginLeft: 'auto',
                background: NAVY, color: WHITE,
                border: 'none', borderRadius: 8,
                padding: '7px 16px', fontSize: 12.5,
                fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Open Roadmap
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ── 3. Waiting For Me ─────────────────────────────────────────────────────────

function WaitingForMeSection({ tasks, loading, error }) {
  const waiting = tasks
    ? tasks.filter((t) => t.status === 'awaiting_human_approval')
    : []

  return (
    <section style={{ flex: '1 1 260px', minWidth: 0 }}>
      <SectionHeading>
        Waiting For Me{waiting.length > 0 ? ` (${waiting.length})` : ''}
      </SectionHeading>
      {loading && <SkeletonCard height={100} />}
      {!loading && error && (
        <ErrorBanner message={`Could not load approvals: ${error}`} />
      )}
      {!loading && !error && waiting.length === 0 && (
        <EmptyState message="No items awaiting your approval. All caught up." />
      )}
      {!loading && !error && waiting.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {waiting.map((t) => (
            <div key={t.id} style={{
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>
                {t.title}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pill tone="amber">Awaiting approval</Pill>
                <Pill tone="navy">{t.taskType}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── 4. Current Development ────────────────────────────────────────────────────

function MetricTile({ label, value, sub }) {
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: '1 1 130px',
    }}>
      <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color: NAVY, lineHeight: 1.15 }}>
        {value ?? '—'}
      </span>
      {sub && (
        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.3 }}>{sub}</span>
      )}
    </div>
  )
}

function CurrentDevSection({ data, loading, error }) {
  return (
    <section>
      <SectionHeading>Current Development</SectionHeading>
      {loading && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6].map((n) => <SkeletonCard key={n} height={70} />)}
        </div>
      )}
      {!loading && error && (
        <ErrorBanner message={`Could not load development status: ${error}`} />
      )}
      {!loading && !error && !data && (
        <EmptyState message="No status data available. Run generate:platform-status." />
      )}
      {!loading && !error && data && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <MetricTile
            label="Branch"
            value={data.git?.branch ?? '—'}
            sub={data.git?.commitShort ? `@ ${data.git.commitShort}` : undefined}
          />
          <MetricTile
            label="Latest Commit"
            value={data.git?.commitDate ?? '—'}
            sub={data.git?.commitMsg?.slice(0, 40) ?? undefined}
          />
          <MetricTile
            label="Routes"
            value={data.counts?.routes ?? '—'}
            sub="API endpoints"
          />
          <MetricTile
            label="DB Tables"
            value={data.counts?.tables ?? '—'}
            sub="Drizzle schemas"
          />
          <MetricTile
            label="Test Files"
            value={data.counts?.testFiles ?? '—'}
            sub={data.quality?.lastTestPass ? `Last: ${data.quality.lastTestPass}` : undefined}
          />
          <MetricTile
            label="TS Errors"
            value={data.quality?.typescriptErrors ?? '—'}
            sub="production code"
          />
        </div>
      )}
    </section>
  )
}

// ── 5. Activity Timeline ──────────────────────────────────────────────────────

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function ActivityTimeline({ events, loading, error }) {
  return (
    <section>
      <SectionHeading>Activity Timeline</SectionHeading>
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[88, 72, 80, 65].map((w, i) => (
            <div key={i} style={{
              background: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <span style={{ ...skeletonRow(w), flex: 1, height: 10 }} />
            </div>
          ))}
        </div>
      )}
      {!loading && error && (
        <ErrorBanner message={`Could not load activity: ${error}`} />
      )}
      {!loading && !error && (!events || events.length === 0) && (
        <EmptyState message="No activity yet. Events will appear here as development tasks are created and updated." />
      )}
      {!loading && !error && events && events.length > 0 && (
        <div style={{
          background: WHITE, border: `1px solid ${BORDER}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {events.map((ev, idx) => (
            <div key={ev.id} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '12px 18px',
              borderTop: idx > 0 ? `1px solid ${BORDER}` : 'none',
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                background: SUBTLE, color: NAVY,
                display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>
                {eventIcon(ev.type)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>
                  {ev.title}
                </span>
                {ev.description && (
                  <p style={{ fontSize: 12.5, color: MUTED, margin: '3px 0 0', lineHeight: 1.4 }}>
                    {ev.description}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap', marginTop: 2 }}>
                {formatRelative(ev.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ onNavigate }) {
  const { data: ps, loading: psLoading, error: psError } = usePlatformStatus()
  const { events, loading: actLoading, error: actError } = useActivity()
  const { tasks, loading: taskLoading, error: taskError } = useTasks()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <PlatformHealthSection
        health={ps?.health}
        loading={psLoading}
        error={psError}
      />
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <NextActionCard
          action={ps?.nextAction}
          loading={psLoading}
          error={psError}
          onOpenRoadmap={() => onNavigate('roadmap')}
        />
        <WaitingForMeSection
          tasks={tasks}
          loading={taskLoading}
          error={taskError}
        />
      </div>
      <CurrentDevSection
        data={ps}
        loading={psLoading}
        error={psError}
      />
      <ActivityTimeline
        events={events}
        loading={actLoading}
        error={actError}
      />
    </div>
  )
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
  const { tasks, loading, error } = useTasks()

  if (loading) {
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

  if (error) {
    return <ErrorBanner message={`Could not load tasks: ${error}`} />
  }

  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState message="No development tasks yet. Create the first task via POST /api/development/tasks." />
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
  const [activeTab, setActiveTab] = useState('overview')

  const isOverview  = activeTab === 'overview'
  const isRoadmap   = activeTab === 'roadmap'
  const content     = TAB_CONTENT[activeTab]

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
            <Pill tone="muted">Sprint 2</Pill>
          </div>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            The primary operating dashboard for developing RRAI. Platform status is generated from repository evidence — no AI reasoning.
          </p>
        </div>

        <TabBar tabs={DEVELOPMENT_TABS} active={activeTab} onChange={setActiveTab} />

        <div style={{ paddingTop: 24 }}>
          {isOverview ? (
            <OverviewTab onNavigate={setActiveTab} />
          ) : isRoadmap ? (
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

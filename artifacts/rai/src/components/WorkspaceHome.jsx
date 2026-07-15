import React from 'react'
import { useListConversations, useListOpportunities, useCreateConversation } from '@workspace/api-client-react'

const NAVY = '#0B1F3A'
const NAVY_LIGHT = '#122240'

const LENS_COLOURS = {
  analyst: '#3b82f6',
  intelligence: '#8b5cf6',
  commercial: '#10b981',
  delivery: '#f59e0b',
}

const LENS_LABELS = {
  analyst: 'Analyst',
  intelligence: 'Intelligence',
  commercial: 'Commercial',
  delivery: 'Delivery',
}

function LensBadge({ lens }) {
  const colour = LENS_COLOURS[lens] ?? '#64748b'
  const label = LENS_LABELS[lens] ?? lens
  return (
    <span style={{
      display: 'inline-block',
      background: `${colour}18`,
      color: colour,
      border: `1px solid ${colour}40`,
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 7px',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#64748b',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{
      padding: '24px 0',
      color: '#94a3b8',
      fontSize: 13,
      textAlign: 'center',
    }}>
      {message}
    </div>
  )
}

export default function WorkspaceHome({ user, isAdmin, onLogout, onSelectModule, onOpenConversation }) {
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'You'

  const { data: convsData, isLoading: convsLoading, refetch: refetchConvs } = useListConversations()
  const { data: oppsData, isLoading: oppsLoading } = useListOpportunities()
  const createConversation = useCreateConversation()

  const conversations = convsData?.conversations ?? []
  const opportunities = (oppsData?.opportunities ?? []).slice(0, 5)

  async function handleNewConversation(lens = 'analyst') {
    try {
      const result = await createConversation.mutateAsync({
        title: 'New Conversation',
        activeLens: lens,
        conversationType: 'general',
      })
      const conv = result?.conversation
      if (conv) {
        await refetchConvs()
        onOpenConversation(conv)
      }
    } catch (err) {
      console.error('Failed to create conversation', err)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f7fb',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        background: NAVY,
        color: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        height: 52,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em' }}>RAI</div>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginLeft: 10,
          marginTop: 1,
        }}>
          Risk AI · Risk Rising
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginRight: 14 }}>
          {displayName}
          {isAdmin && <span style={{ marginLeft: 6, color: '#60a5fa', fontSize: 10, fontWeight: 700 }}>ADMIN</span>}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.7)',
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
        {/* Left column */}
        <div>
          {/* Continue working */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px', marginBottom: 24 }}>
            <SectionHeader>Continue working</SectionHeader>
            {convsLoading && (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            )}
            {!convsLoading && conversations.length === 0 && (
              <EmptyState message="No recent conversations. Start one below." />
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onOpenConversation(conv)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  gap: 12,
                  marginBottom: 2,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f7fb'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: NAVY,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {conv.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LensBadge lens={conv.activeLens} />
                    {conv.opportunityId && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>Opportunity linked</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', paddingTop: 2 }}>
                  {timeAgo(conv.lastMessageAt ?? conv.updatedAt)}
                </div>
              </button>
            ))}
          </div>

          {/* Active opportunities */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px' }}>
            <SectionHeader>Active opportunities</SectionHeader>
            {oppsLoading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}
            {!oppsLoading && opportunities.length === 0 && (
              <EmptyState message="No active opportunities." />
            )}
            {opportunities.map(opp => (
              <div
                key={opp.opportunity_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: NAVY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {opp.company}
                  </div>
                  {opp.stage && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {opp.stage}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onSelectModule('logicgate')}
                  style={{
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Open →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Start something new */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px', marginBottom: 20 }}>
            <SectionHeader>Start something new</SectionHeader>

            <ActionButton
              label="New conversation"
              description="Chat with the AI assistant"
              onClick={() => handleNewConversation('analyst')}
              loading={createConversation.isPending}
              primary
            />
            <div style={{ height: 8 }} />
            <ActionButton
              label="RFP / RFI Workbench"
              description="Draft and structure responses"
              onClick={() => onSelectModule('rfp')}
            />
            <div style={{ height: 8 }} />
            <ActionButton
              label="LogicGate Specialist"
              description="Deal strategy and discovery"
              onClick={() => onSelectModule('logicgate')}
            />
            {isAdmin && (
              <>
                <div style={{ height: 8 }} />
                <ActionButton
                  label="Development"
                  description="Platform workspace (admin)"
                  onClick={() => onSelectModule('development')}
                />
              </>
            )}
          </div>

          {/* Lens quick-start */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px' }}>
            <SectionHeader>Start with a lens</SectionHeader>
            {Object.entries(LENS_LABELS).map(([lens, label]) => (
              <button
                key={lens}
                onClick={() => handleNewConversation(lens)}
                disabled={createConversation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  background: 'none',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginBottom: 6,
                  gap: 10,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!createConversation.isPending) e.currentTarget.style.background = '#f4f7fb' }}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: LENS_COLOURS[lens],
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ label, description, onClick, loading, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        background: primary ? NAVY : 'none',
        border: primary ? 'none' : '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 14px',
        cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: primary ? '#fff' : NAVY,
        marginBottom: 2,
      }}>
        {loading ? 'Creating…' : label}
      </div>
      <div style={{ fontSize: 11, color: primary ? 'rgba(255,255,255,0.55)' : '#64748b' }}>
        {description}
      </div>
    </button>
  )
}

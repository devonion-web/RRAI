import React from 'react'
import WorkspaceHome from './components/WorkspaceHome'
import ConversationView from './components/ConversationView'
// @ts-ignore — plain JS modules; TS checks skipped
import LogicGateModule from './modules/logicgate/LogicGateModule'
// @ts-ignore
import RFPModule from './modules/rfp/RFPModule'
// @ts-ignore
import DevelopmentModule from './modules/development/DevelopmentModule'
import { useAuth } from '@workspace/replit-auth-web'

type ModuleId = string | null

interface ConversationRef {
  id: string
  title: string
  activeLens?: string | null
  [key: string]: unknown
}

const NAVY = '#0B1F3A'

const backBarStyle: React.CSSProperties = {
  background: NAVY,
  color: '#fff',
  padding: '8px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 13,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const backButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  color: '#fff',
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const MODULE_LABELS: Record<string, string> = {
  logicgate: 'LogicGate Specialist',
  rfp: 'RFP / RFI Workbench',
  proposal: 'Proposal Specialist',
  marketing: 'Marketing Specialist',
  delivery: 'Delivery Specialist',
  knowledge: 'Knowledge Specialist',
  development: 'Development',
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: NAVY,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
        Loading…
      </div>
    </div>
  )
}

function SignInScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f7fb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        padding: '48px 56px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(11,31,58,0.08)',
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          color: NAVY,
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          RAI
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          Risk AI · Risk Rising
        </div>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
          Sign in to access the RAI operating platform.
        </p>
        <button
          onClick={onLogin}
          style={{
            width: '100%',
            background: NAVY,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { user, isLoading, isAuthenticated, isAdmin, login, logout } = useAuth()
  const [activeModule, setActiveModule] = React.useState<ModuleId>(null)
  const [activeConversation, setActiveConversation] = React.useState<ConversationRef | null>(null)

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <SignInScreen onLogin={login} />

  // Admin-only lens: never render for non-admins, even if the id is set.
  const showDevelopment = activeModule === 'development' && isAdmin

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'You'

  // ── Module view ───────────────────────────────────────────────────────────
  if (activeModule) {
    const goHome = () => {
      setActiveModule(null)
      setActiveConversation(null)
    }

    return (
      <div>
        {activeModule !== 'rfp' && (
          <div style={backBarStyle}>
            <button style={backButtonStyle} onClick={goHome}>
              ← RAI Home
            </button>
            <span style={{ opacity: 0.55 }}>
              {MODULE_LABELS[activeModule] ?? activeModule}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ opacity: 0.45, fontSize: 12 }}>{displayName}</span>
            <button
              style={{ ...backButtonStyle, marginLeft: 8 }}
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        )}
        {activeModule === 'rfp' && <RFPModule onBack={goHome} />}
        {activeModule === 'logicgate' && <LogicGateModule />}
        {showDevelopment && <DevelopmentModule />}
      </div>
    )
  }

  // ── Conversation view ─────────────────────────────────────────────────────
  if (activeConversation) {
    return (
      <ConversationView
        conversationId={activeConversation.id}
        onBack={() => setActiveConversation(null)}
      />
    )
  }

  // ── Workspace home (default) ──────────────────────────────────────────────
  return (
    <WorkspaceHome
      user={user}
      isAdmin={isAdmin}
      onLogout={logout}
      onSelectModule={setActiveModule}
      onOpenConversation={(conv: ConversationRef) => setActiveConversation(conv)}
    />
  )
}

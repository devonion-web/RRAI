import React from 'react'
import { MODULES } from '../config/modules.js'

const NAVY = '#0B1F3A'
const NAVY_LIGHT = '#EAF1F8'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'

export default function RaiDashboard({ onSelectModule, user, isAdmin, onLogout }) {
  // Admin-only modules are hidden from non-admins. Additive: existing modules
  // have no `adminOnly` flag and are unaffected. Role is server-provided —
  // the client cannot influence it.
  const visibleModules = MODULES.filter((mod) => !mod.adminOnly || isAdmin)

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Signed in'
    : null

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          background: NAVY,
          padding: '18px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        <div>
          <div
            style={{
              color: '#fff',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            RAI
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 3,
            }}
          >
            Risk AI · Risk Rising
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}
        >
          Operating Platform
        </div>
        {displayName && (
          <>
            <div
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                fontWeight: 500,
                marginLeft: 8,
              }}
            >
              {displayName}
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 6,
                color: '#fff',
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginLeft: 4,
              }}
            >
              Sign out
            </button>
          </>
        )}
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '44px 30px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: NAVY,
              margin: 0,
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            Select a Module
          </h1>
          <p style={{ fontSize: 15, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            Choose a specialist to get started. Each module is optimised for a specific workflow.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {visibleModules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onSelect={() => mod.status === 'active' && onSelectModule(mod.id)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

function ModuleCard({ module, onSelect }) {
  const isActive = module.status === 'active'
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => isActive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${hovered ? '#94a3b8' : BORDER}`,
        padding: '24px',
        cursor: isActive ? 'pointer' : 'default',
        opacity: isActive ? 1 : 0.6,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 6px 20px rgba(11,31,58,0.10)'
          : '0 1px 3px rgba(15,23,42,0.04)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          marginBottom: 14,
        }}
      >
        {module.category}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 28, marginBottom: 8, lineHeight: 1 }}>{module.icon}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>
            {module.title}
          </div>
        </div>
        {isActive ? (
          <span
            style={{
              background: '#dcfce7',
              color: '#15803d',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            Active
          </span>
        ) : (
          <span
            style={{
              background: NAVY_LIGHT,
              color: NAVY,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            Coming Soon
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: 13,
          color: MUTED,
          lineHeight: 1.65,
          margin: 0,
          flex: 1,
          marginBottom: isActive ? 18 : 0,
        }}
      >
        {module.description}
      </p>

      {isActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 700,
            color: hovered ? '#1d4ed8' : NAVY,
            transition: 'color 0.15s ease',
          }}
        >
          Launch module <span>→</span>
        </div>
      )}
    </div>
  )
}

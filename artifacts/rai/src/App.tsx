import React, { useState } from 'react'
import RaiDashboard from './components/RaiDashboard'
// @ts-ignore — plain JS modules; TS checks skipped
import LogicGateModule from './modules/logicgate/LogicGateModule'
// @ts-ignore
import RFPModule from './modules/rfp/RFPModule'
// @ts-ignore
import OIModule from './modules/oi/OIModule'

type ModuleId = string | null

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
  oi: 'Opportunity Intelligence',
  logicgate: 'LogicGate Specialist',
  rfp: 'RFP / RFI Response Manager',
  proposal: 'Proposal Specialist',
  marketing: 'Marketing Specialist',
  delivery: 'Delivery Specialist',
  knowledge: 'Knowledge Specialist',
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(null)

  if (activeModule) {
    return (
      <div>
        {activeModule !== 'oi' && (
          <div style={backBarStyle}>
            <button style={backButtonStyle} onClick={() => setActiveModule(null)}>
              ← RAI Home
            </button>
            <span style={{ opacity: 0.55 }}>
              {MODULE_LABELS[activeModule] ?? activeModule}
            </span>
          </div>
        )}
        {activeModule === 'oi' && <OIModule onBack={() => setActiveModule(null)} />}
        {activeModule === 'logicgate' && <LogicGateModule />}
        {activeModule === 'rfp' && <RFPModule />}
      </div>
    )
  }

  return <RaiDashboard onSelectModule={setActiveModule} />
}

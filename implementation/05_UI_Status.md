<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit c23c100 (branch: feature/development-orchestrator-foundation)
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
# UI Status
## 05_UI_Status.md

---

## Summary

| Area | Technology | Status |
| --- | --- | --- |
| Framework | React 19 + Vite | Production |
| Styling | Inline JS styles (Inter, navy theme) | Active |
| Routing | Wouter | Active |
| State management | React local state (useState) | Active |
| Module registry | `artifacts/rai/src/config/modules.js` | Active |

---

## Registered Modules (from modules.js)

Active:
- **Development** (`development`)
- **LogicGate Specialist** (`logicgate`)
- **RFP Response Drafter** (`rfp`)

Planned (coming_soon):
- **Delivery Specialist** (`delivery`)
- **Knowledge Specialist** (`knowledge`)
- **Marketing Specialist** (`marketing`)
- **Proposal Specialist** (`proposal`)

---

## Components

- `ConversationView.jsx`
- `RaiDashboard.jsx`
- `WorkspaceHome.jsx`

---

## Navigation Structure

```
App.tsx
├── WorkspaceHome     (default landing — conversation list + new conversation)
├── ConversationView  (active conversation with SSE streaming)
└── Module views (via activeModule state)
    ├── Development
    ├── LogicGate Specialist
    ├── RFP Response Drafter
```

---

## Admin Interface

Admin capabilities are API-only. No dedicated admin frontend exists beyond direct API access.
Available via: `/api/admin/knowledge/*`

---

## UI Maturity

| Area | Status |
| --- | --- |
| Conversation workspace | Production |
| Development module | Production |
| LogicGate Specialist module | Production |
| RFP Response Drafter module | Production |
| Admin interface | API-only (no UI) |
| Opportunity management | Not present |
| Organisation settings | Not present |
| Learning / approval UI | Not present |

---

## Known UI Debt

1. No dedicated admin UI for knowledge management, approval workflow or user management
2. No opportunity or contact management screens
3. No organisation settings screen
4. Module back-navigation uses in-App state; deep-linking not supported

---

_Module list sourced from `artifacts/rai/src/config/modules.js` (authoritative registry). Filesystem directory listing is supplementary only._

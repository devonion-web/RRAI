# UI Status
## 05_UI_Status.md
Generated: 2026-07-15 13:37:27 UTC

---

## Summary

| Area | Technology | Status |
|---|---|---|
| Framework | React 19 + Vite | Production |
| Styling | Inline JS styles (navy theme) | Active |
| Routing | Wouter | Active |
| State management | React local state + useState | Active |
| Font | Inter (CSS variable) | Active |
| Module registry | config/modules.js | Active |

---

## Modules

- **development** (`artifacts/rai/src/modules/development/`)
- **logicgate** (`artifacts/rai/src/modules/logicgate/`)
- **rfp** (`artifacts/rai/src/modules/rfp/`)

**Planned but not implemented:**
- Proposal Specialist
- Marketing Specialist
- Delivery Specialist
- Knowledge Specialist

---

## Components

- `ConversationView.jsx`
- `RaiDashboard.jsx`
- `WorkspaceHome.jsx`

---

## Navigation Structure

```
App.tsx
├── WorkspaceHome  (default landing — conversation list + new conversation)
├── ConversationView  (active conversation with SSE streaming)
└── Module views (via activeModule state)
    ├── LogicGate Specialist
    ├── RFP/RFI Workbench
    └── Development [partial]
```

---

## Admin Interface

- Knowledge index status and reindex trigger
- Per-asset indexing
- Manifest inspection
- Corpus status (chunk counts)
- Retrieval policy inspection
- Search testing interface

These are currently API-only (no dedicated admin frontend beyond the API routes).

---

## UI Maturity

| Area | Maturity |
|---|---|
| Conversation workspace | Production |
| LogicGate Specialist module | Production |
| RFP/RFI Workbench | Production |
| Admin interface | API-only (no UI) |
| Opportunity management | Not present |
| Organisation management | Not present |
| Learning / approval UI | Not present |

---

## Known UI Debt

1. No dedicated admin UI for knowledge management, approval workflow or user management
2. No opportunity or contact management screens
3. No organisation settings screen
4. Module back-navigation uses in-App state; deep-linking not supported
5. Mobile responsiveness not validated across all modules

---

_Frontend artifact: `artifacts/rai/`. Dev server: `pnpm --filter @workspace/rai run dev` (port from PORT env)._

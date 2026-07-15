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
# RRAI Platform Status
## 00_Platform_Status.md

---

## Platform Identity

| Field | Value |
| --- | --- |
| Platform | RRAI — Risk AI |
| Owner | Risk Rising |
| Branch | `feature/development-orchestrator-foundation` |
| Commit | `c23c100` |
| Commit Message | Add query client provider to enable data fetching |
| Commit Date | 2026-07-15 14:53:15 +0000 |
| Commit Count | 81 |
| Remote | https://github.com/devonion-web/RRAI.git |

---

## Implementation Status

_Status values: Implemented / Partial / Schema only / Planned_

| Engine / Area | Status |
| --- | --- |
| Authentication & authorisation | Implemented |
| Conversation engine | Implemented |
| Knowledge engine (RAG v1) | Implemented |
| Lens routing engine | Implemented |
| LogicGate Specialist module | Implemented |
| RFP/RFI Workbench module | Implemented |
| Database schema | Implemented |
| API surface | Partial |
| Development Orchestrator | Partial |
| Document engine | Partial |
| Frontend shell | Partial |
| Organisation management | Partial |
| Opportunity tracking | Partial |
| Approval engine | Schema only |
| Learning engine | Schema only |
| Memory engine | Schema only |
| Agent orchestrator | Planned |
| Automation engine | Planned |
| Presentation engine | Planned |
| Reasoning engine | Planned |

---

## Implemented Capabilities

- **Authentication** — Replit OIDC (PKCE), PostgreSQL session store, role-based access (admin/member), mobile auth token endpoint, org-scoped membership
- **Conversations** — Full CRUD, persistent messages, SSE streaming, lens assignment, opportunity linkage, retrieval traces per message
- **Knowledge Engine** — 13-asset manifest, 12 active (12 supplied to LLM), 186 indexed chunks, FTS with OR-based lexeme union, hybrid scoring (retrieval-policy-v1.2)
- **Lens Routing** — 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition-based routing, one-way security valve
- **RAG Retrieval** — Full-text search, hybrid scoring (FTS rank × 2.0 + metadata), sensitivity ceiling, diversity caps, conflict detection, retrieval trace logging
- **LogicGate Specialist** — Pre/post-discovery prep, deal scoring, SoW generation, email drafting
- **RFP/RFI Workbench** — Document decomposition, section drafting, requirements management, quality review pipeline
- **Admin Panel** — Knowledge indexing, manifest inspection, corpus status, retrieval policy, search testing
- **Development Orchestrator** — AI task management, review findings, change proposals, approval workflow, repository references
- **Organisation Management** — Multi-tenant orgs, membership, role assignment, org-scoped data isolation

---

## Partially Implemented Capabilities

- **Memory Engine** — Schema defined; not yet used in conversation context assembly
- **Opportunity Tracking** — DB persisted, basic CRUD; no frontend UI
- **Learning Engine** — DB tables present; no learning pipeline active
- **Document Engine** — RFP pipeline implemented; broader production pipeline not built

---

## Planned Capabilities

- Semantic / vector-embedding retrieval (FTS-only today)
- Approval Engine pipeline
- Automation Engine
- Agent Orchestrator
- Presentation Engine (slide generation)
- OpenAPI specification (api-spec/ directory)

---

## Registered Modules

Active:
- **Development** (`development`)
- **LogicGate Specialist** (`logicgate`)
- **RFP Response Drafter** (`rfp`)

Planned:
- **Delivery Specialist** (`delivery`) — coming soon
- **Knowledge Specialist** (`knowledge`) — coming soon
- **Marketing Specialist** (`marketing`) — coming soon
- **Proposal Specialist** (`proposal`) — coming soon

---

## Workspace Packages

- **@workspace/rai** (`artifacts/rai`) — frontend, v0.0.0
- **@workspace/api-server** (`artifacts/api-server`) — api-server, v0.0.0
- **@workspace/mockup-sandbox** (`artifacts/mockup-sandbox`) — dev-tool, v2.0.0
- **@workspace/db** (`lib/db`) — shared-library, v0.0.0
- **@workspace/scripts** (`scripts`) — scripts, v0.0.0

---

## Summary Counts

| Area | Count |
| --- | --- |
| Database tables | 21 across 6 schema files |
| API routes | 104 across 7 route files (all prefixed `/api`) |
| Admin routes | 12 |
| Knowledge assets | 13 (12 active, 2 approved, 11 draft) |
| Indexed chunks | 186 (last reindex) |
| Test files | 9 |
| Evaluation cases | 53 |

---

## Last Evaluation Results

| Gate | Threshold | Result |
| --- | --- | --- |
| Recall@5 | ≥85% | 100.0% ✅ |
| Top-1 accuracy | ≥70% | 77.4% ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| TypeScript | Zero errors | ✅ |
| Tests | All pass | 19/19 ✅ |

---

## Known Technical Debt

1. No OpenAPI specification — `api-spec/` directory is absent; CI codegen step references a non-existent package
2. RFP module uses in-memory stores with TTL (not database-persisted)
3. LogicGate routes retain some in-memory opportunity/contact stores
4. No vector embeddings — FTS-only retrieval (planned for Phase 3)
5. 11 of 13 knowledge assets are still `draft`; require expert review and approval
6. `knowledge/Knowledge Governance.md` is a 7-line placeholder (restricted from indexing)

---

## Next Recommended Engine

**Document Engine v1** — Staged proposal generation with timeout-safe streaming. Already validated via RFP pipeline; generalise to all proposal types.

---

_Derived from repository at commit `c23c100` on branch `feature/development-orchestrator-foundation`._

# RRAI Platform Status
## 00_Platform_Status.md
Generated: 2026-07-15 13:37:27 UTC  
Generator: scripts/src/generate-platform-status.ts

---

## Platform Identity

| Field | Value |
|---|---|
| Platform | RRAI — Risk AI |
| Owner | Risk Rising |
| Branch | `feature/development-orchestrator-foundation` |
| Commit | `b747652` |
| Commit Message | Improve search relevance and recall by optimizing full-text search |
| Commit Date | 2026-07-15 13:20:01 +0000 |
| Commit Count | 79 |
| Remote | https://github.com/devonion-web/RRAI.git |
| Repository State | ⚠️ 13 modified file(s) |

---

## Architecture Completion Estimate

| Engine / Area | Status | Completion |
|---|---|---|
| Authentication & authorisation | ✅ Implemented | ~90% |
| Database schema | ✅ Implemented | ~75% |
| Knowledge engine (RAG v1) | ✅ Implemented | ~85% |
| Conversation engine | ✅ Implemented | ~80% |
| Lens routing engine | ✅ Implemented | ~80% |
| LogicGate Specialist module | ✅ Implemented | ~90% |
| RFP/RFI Workbench module | ✅ Implemented | ~75% |
| Development Orchestrator | ✅ Implemented | ~60% |
| API surface | 🔄 Partial | ~55% |
| Frontend shell | 🔄 Partial | ~70% |
| Organisation management | 🔄 Partial | ~65% |
| Opportunity tracking | 🔄 Partial | ~50% |
| Memory engine | ⬜ Schema only | ~10% |
| Learning engine | ⬜ Schema only | ~10% |
| Document engine | ⬜ Partial | ~35% |
| Approval engine | ⬜ Schema only | ~10% |
| Reasoning engine | ⬜ Planned | ~5% |
| Agent orchestrator | ⬜ Planned | ~5% |
| Automation engine | ⬜ Planned | 0% |
| Presentation engine | ⬜ Planned | 0% |
| **Overall platform** | | **~45%** |

---

## Implemented Capabilities

- **Authentication** — Replit OIDC (PKCE), PostgreSQL session store, role-based access (admin/member), mobile auth token endpoint, org-scoped membership
- **Conversations** — Full CRUD, persistent messages, SSE streaming, lens assignment, opportunity linkage, retrieval traces per message
- **Knowledge Engine** — 13-asset manifest, 12 active assets, 186 indexed chunks, FTS with OR-based lexeme union, hybrid scoring (retrieval-policy-v1.2)
- **Lens Routing** — 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition-based routing, one-way security valve
- **RAG Retrieval** — Full-text search, hybrid scoring (FTS rank × 2.0 + metadata), sensitivity ceiling, diversity caps, conflict detection, retrieval trace logging
- **LogicGate Specialist** — Pre/post-discovery prep, deal scoring, SoW generation, email drafting
- **RFP/RFI Workbench** — Document decomposition, section drafting, requirements management, quality review pipeline
- **Admin Panel** — Knowledge indexing, manifest inspection, corpus status, retrieval policy, search testing
- **Development Orchestrator** — AI task management, review findings, change proposals, approval workflow, repository references
- **Organisation Management** — Multi-tenant orgs, membership, role assignment, org-scoped data isolation

---

## Partially Implemented Capabilities

- **Memory Engine** — Schema defined (not yet used in conversation context assembly)
- **Opportunity Tracking** — DB persisted, basic CRUD; no frontend UI
- **Learning Engine** — DB tables present (learningOutcomesTable, aiRunsTable); no learning pipeline
- **Document Engine** — RFP pipeline implemented; broader production pipeline not built

---

## Planned Capabilities (Not Yet Implemented)

- Semantic / vector-embedding retrieval (FTS-only today)
- Approval Engine pipeline
- Automation Engine
- Agent Orchestrator
- Presentation Engine (slide generation)
- Proposal Specialist, Marketing Specialist, Delivery Specialist, Knowledge Specialist modules
- OpenAPI specification (api-spec/ directory)

---

## Workspace Packages

- **@workspace/rai** (`artifacts/rai`) — frontend, v0.0.0
- **@workspace/api-server** (`artifacts/api-server`) — api-server, v0.0.0
- **@workspace/mockup-sandbox** (`artifacts/mockup-sandbox`) — dev-tool, v2.0.0
- **@workspace/db** (`lib/db`) — shared-library, v0.0.0
- **@workspace/scripts** (`scripts`) — scripts, v0.0.0

---

## Database

- **Total tables:** 21 across 6 schema files
- **ORM:** Drizzle ORM + pg driver
- **Database:** PostgreSQL (Replit-managed)

## API

- **Total routes:** 104 across 7 route files
- **Admin routes:** 12
- **Public routes:** 92

## Knowledge

- **Manifest assets:** 13 (12 active, 2 approved, 11 draft)
- **Indexed chunks:** 186 (last reindex)
- **Retrieval policy:** retrieval-policy-v1.2
- **Evaluation:** Recall@5 = 100.0%, Top-1 = 77.4%, Irrelevant = 0.0%

## Tests

- **Test files:** 8
- **Last known pass rate:** 19/19
- **Evaluation cases:** 53
- **TypeScript:** Zero errors (all packages)

---

## Known Technical Debt

1. No OpenAPI specification — `api-spec/` directory is absent; CI codegen step references a non-existent package
2. RFP module uses in-memory stores with TTL (not database-persisted)
3. LogicGate routes retain some in-memory opportunity/contact stores
4. No vector embeddings — FTS-only retrieval (planned for Phase 3)
5. 10 of 13 knowledge assets are still `draft`; content needs expert review and approval
6. knowledge/Knowledge Governance.md is a 7-line placeholder (restricted from indexing)

---

## Next Recommended Engine

**Document Engine v1** — Staged proposal generation with timeout-safe streaming. Resolves the active UX defect where long-running generation causes HTTP timeouts. Already validated via RFP pipeline; generalise to all proposal types.

---

_Generated from repository at commit `b747652` on branch `feature/development-orchestrator-foundation`._

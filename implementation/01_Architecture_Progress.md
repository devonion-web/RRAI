<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit 8a5454e (branch: feature/development-orchestrator-foundation)
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
# Architecture vs Implementation Progress
## 01_Architecture_Progress.md

---

## Classification Key

| Symbol | Meaning |
| --- | --- |
| ✅ Implemented | Working in production code |
| 🔄 Partial | Core capability present, gaps remain |
| ⬜ Schema-only | DB tables defined; no service logic |
| 📋 Planned | Architecture defined; implementation not started |

---

## Core Platform Architecture

| Area | Architecture | Status | Notes |
| --- | --- | --- | --- |
| Multi-tenant organisations | ✅ | ✅ Implemented | Full CRUD |
| Lens routing (4 lenses) | ✅ | ✅ Implemented | One-way security valve |
| Knowledge partitioning | ✅ | ✅ Implemented | 5-tier partition |
| Session management | ✅ | ✅ Implemented | PostgreSQL-backed |
| Role-based access | ✅ | ✅ Implemented | admin / member |
| API-first contract | ✅ | 📋 Planned | No OpenAPI spec yet |

---

## Engines

| Engine | Architecture | Status | Notes |
| --- | --- | --- | --- |
| Authentication Engine | ✅ | ✅ Implemented | OIDC + PKCE + PostgreSQL sessions |
| Knowledge Engine | ✅ | ✅ Implemented | RAG v1.1, FTS, 186 chunks |
| Conversation Engine | ✅ | ✅ Implemented | SSE streaming, persistent |
| Retrieval Engine | ✅ | ✅ Implemented | Hybrid scoring, partition security |
| Lens Routing Engine | ✅ | ✅ Implemented | 4 lenses |
| Development Orchestrator | ✅ | 🔄 Partial | Task/approval loop; no AI-driven PR |
| Document Engine | ✅ | 🔄 Partial | RFP pipeline only |
| Memory Engine | ✅ | ⬜ Schema-only | Tables defined; not wired to conversations |
| Learning Engine | ✅ | ⬜ Schema-only | learningOutcomes table; no pipeline |
| Reasoning Engine | ✅ | 📋 Planned | No implementation |
| Approval Engine | ✅ | ⬜ Schema-only | approvalsTable exists; no pipeline |
| Agent Orchestrator | ✅ | 📋 Planned | Not started |
| Automation Engine | ✅ | 📋 Planned | Not started |
| Presentation Engine | ✅ | 📋 Planned | Not started |

---

## Modules

| Module | Architecture | Status | Source |
| --- | --- | --- | --- |
| Delivery Specialist | ✅ | 📋 Planned | modules.js registry |
| Development | ✅ | ✅ Implemented | modules.js registry |
| Knowledge Specialist | ✅ | 📋 Planned | modules.js registry |
| LogicGate Specialist | ✅ | ✅ Implemented | modules.js registry |
| Marketing Specialist | ✅ | 📋 Planned | modules.js registry |
| Proposal Specialist | ✅ | 📋 Planned | modules.js registry |
| RFP Response Drafter | ✅ | ✅ Implemented | modules.js registry |

---

## Data Architecture

| Table Group | Status | Notes |
| --- | --- | --- |
| Auth (sessions, users) | ✅ Implemented | OIDC session store |
| Conversations + Messages | ✅ Implemented | Persistent |
| Knowledge Chunks | ✅ Implemented | 186 chunks, 8 retrieval trace columns |
| Retrieval Traces | ✅ Implemented | Per-message provenance |
| Organisations | ✅ Implemented | Multi-tenant |
| Development Tasks | ✅ Implemented | AI task loop |
| Opportunities | 🔄 Partial | Schema exists; limited API surface |
| Contacts | ⬜ Schema-only | No frontend |
| Learning Outcomes | ⬜ Schema-only | Not populated |
| Vector Embeddings | 📋 Planned | FTS used instead |

---

## Known Implementation Drift

1. **In-memory RFP stores** — Architecture assumes persistent document storage; implementation uses TTL-bound in-memory Map (4-hour TTL).
2. **LogicGate opportunity store** — Architecture assumes DB persistence; logicgate route uses in-memory Map.
3. **OpenAPI spec** — Architecture references contract-first API; `api-spec/` is absent.
4. **Knowledge Governance** — 7-line placeholder file; governance framework not implemented.

---

_Governing documents: architecture/00_RRAI_Master_Context_v2_0.md (authority), architecture/01_RRAI_Platform_Architecture_v1_0.md (implementation spec)._

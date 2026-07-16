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
# Engine Status
## 02_Engine_Status.md

---

## Authentication Engine

- **Status:** Implemented
- **Version:** OIDC-v1 (Replit Auth)
- **Implemented:** OIDC + PKCE flow, PostgreSQL session store, role enum (admin/member), org membership enforcement, mobile auth token endpoint, RRAI_ADMIN_EMAILS env-driven role assignment
- **Missing:** Fine-grained capability permissions beyond admin/member; session expiry UI
- **Location:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/lib/auth.ts`

---

## Knowledge Engine

- **Status:** Implemented (RAG v1.1)
- **Version:** retrieval-policy-v1.2
- **Implemented:** 13-asset manifest with partition/sensitivity/tier metadata, FTS chunking, OR-based lexeme union search, hybrid scoring (FTS × 2.0 multiplier + heading/tag boosts + evidence tier), sensitivity ceiling enforcement, diversity caps, conflict detection, retrieval trace logging, admin reindex and search endpoints, evaluation runner (53 cases)
- **Missing:** Vector embeddings / semantic search; approved-status review (11 assets still draft)
- **Last Evaluation:** Recall@5 = 100.0%, Top-1 = 77.4%, Irrelevant = 0.0%, P95 latency ≈ 16ms
- **Location:** `artifacts/api-server/src/services/knowledge-*.ts`, `artifacts/api-server/src/lib/knowledge-manifest.ts`, `artifacts/api-server/src/config/retrieval-policy.ts`

---

## Conversation Engine

- **Status:** Implemented
- **Version:** conversation-v1
- **Implemented:** Conversation CRUD, message persistence, SSE streaming, lens assignment, opportunity linkage, context retrieval integration, retrieval trace per message, multi-turn history window
- **Missing:** Conversation search/filtering, export, summarisation for long histories
- **Location:** `artifacts/api-server/src/routes/conversations.ts`, `artifacts/api-server/src/services/conversations-service.ts`, `artifacts/api-server/src/services/assistant-service.ts`

---

## Lens Routing Engine

- **Status:** Implemented
- **Version:** lens-policy-v1
- **Implemented:** 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition mapping, one-way security valve, lens assignment API, retrieval policy enforcement per lens
- **Missing:** Dynamic lens selection based on conversation content; deeper lens-specific prompt differentiation
- **Location:** `artifacts/api-server/src/lib/lens-policy.ts`, `artifacts/api-server/src/services/lens-routing-service.ts`

---

## Retrieval Engine

- **Status:** Implemented
- **Version:** retrieval-policy-v1.2
- **Implemented:** OR-based FTS, question-filler-word stripping, hybrid scoring, partition security, sensitivity ceiling, near-duplicate suppression, safe tag-based fallback, per-request retrieval traces
- **Missing:** Vector semantic search, embedding model integration
- **Location:** `artifacts/api-server/src/services/knowledge-search-service.ts`, `artifacts/api-server/src/config/retrieval-policy.ts`

---

## Development Orchestrator

- **Status:** Partial
- **Version:** dev-orchestrator-v1
- **Implemented:** Task CRUD, AI run tracking, review findings, change proposals, approval workflow, repository references, audit events; admin-only route guard
- **Missing:** Automated PR generation, GitHub API integration, AI-driven code review
- **Location:** `artifacts/api-server/src/routes/development.ts`, `lib/db/src/schema/development.ts`

---

## Document Engine

- **Status:** Partial
- **Version:** rfp-v1 (partial)
- **Implemented:** RFP/RFI document decomposition, section-based drafting with SSE streaming, requirements extraction, quality review pipeline, document assembly, in-memory store (4-hour TTL)
- **Missing:** Persistent document storage, generalised proposal generation, staged generation with timeout safety
- **Next Milestone:** Staged proposal generation — active priority
- **Location:** `artifacts/api-server/src/routes/rfp.ts`, `artifacts/api-server/prompts/`

---

## Memory Engine

- **Status:** Schema only
- **Implemented:** opportunitiesTable, contactsTable, opportunityEventsTable, opportunityWorkingStateTable defined; basic opportunity CRUD
- **Missing:** Memory integration into conversation context, memory retrieval service
- **Location:** `lib/db/src/schema/runtime.ts`, `artifacts/api-server/src/services/opportunities-service.ts`

---

## Learning Engine

- **Status:** Schema only
- **Implemented:** learningOutcomesTable, aiRunsTable defined
- **Missing:** Feedback capture UI, outcome classification, knowledge proposal pipeline, human approval gate
- **Location:** `lib/db/src/schema/development.ts`

---

## Approval Engine

- **Status:** Schema only
- **Implemented:** approvalsTable, changeProposalsTable defined; development route accepts approval submissions
- **Missing:** Approval UI, notification system, approval state machine, governance enforcement
- **Location:** `lib/db/src/schema/development.ts`

---

## Engines Not Yet Started

- **Reasoning Engine** — Structured multi-step reasoning
- **Agent Orchestrator** — Coordinates multiple specialist agents
- **Automation Engine** — Scheduled and event-driven task execution
- **Presentation Engine** — Slide deck and visual document generation

---

_All engine locations are within the monorepo at the paths listed above._

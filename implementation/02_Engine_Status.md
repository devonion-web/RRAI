# Engine Status
## 02_Engine_Status.md
Generated: 2026-07-15 13:37:27 UTC

---

## Authentication Engine

- **Purpose:** Secures all platform access via OIDC; manages user identity, sessions, org membership and roles
- **Version:** OIDC-v1 (Replit Auth)
- **Completion:** ~90%
- **Implemented:** OIDC + PKCE flow, PostgreSQL session store, role enum (admin/member), org membership enforcement, mobile auth token endpoint, RRAI_ADMIN_EMAILS env-driven role assignment
- **Missing:** Fine-grained capability permissions beyond admin/member; session expiry UI
- **Location:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/lib/auth.ts`
- **Dependencies:** PostgreSQL, Replit OIDC, SESSION_SECRET env

---

## Knowledge Engine

- **Purpose:** Governs and indexes all knowledge assets; serves as the semantic retrieval backbone
- **Version:** RAG v1.1 / retrieval-policy-v1.2
- **Completion:** ~85%
- **Implemented:** 13-asset manifest with partition/sensitivity/tier metadata, FTS chunking (chunk-v1), OR-based lexeme union search, hybrid scoring (FTS × 2.0 multiplier + heading/tag boosts + evidence tier), sensitivity ceiling enforcement, diversity caps, conflict detection, retrieval trace logging, admin reindex and search endpoints, evaluation runner (53 cases)
- **Missing:** Vector embeddings / semantic search, approved-status knowledge review (10 assets still draft), Knowledge Governance implementation
- **Location:** `artifacts/api-server/src/services/knowledge-*.ts`, `artifacts/api-server/src/lib/knowledge-manifest.ts`, `artifacts/api-server/src/config/retrieval-policy.ts`
- **Last Evaluation:** Recall@5 = 100.0%, Top-1 = 77.4%, Irrelevant = 0.0%, P95 latency = 16ms

---

## Conversation Engine

- **Purpose:** Manages multi-turn AI conversations with persistent history and lens-scoped context
- **Version:** conversation-v1
- **Completion:** ~80%
- **Implemented:** Conversation CRUD, message persistence, SSE streaming, lens assignment, opportunity linkage, context retrieval integration (knowledge search → context assembly), retrieval trace per message, multi-turn history window
- **Missing:** Conversation search/filtering, conversation export, summarisation for long histories
- **Location:** `artifacts/api-server/src/routes/conversations.ts`, `artifacts/api-server/src/services/conversations-service.ts`, `artifacts/api-server/src/services/assistant-service.ts`
- **Dependencies:** Knowledge Engine, Lens Routing Engine, Anthropic Claude

---

## Lens Routing Engine

- **Purpose:** Routes each conversation to the correct knowledge partition based on active lens
- **Version:** lens-policy-v1
- **Completion:** ~80%
- **Implemented:** 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition mapping, one-way security valve (analyst cannot access intelligence/commercial), lens assignment API, retrieval policy enforcement per lens
- **Missing:** Dynamic lens selection based on conversation content; lens-specific system prompt differentiation beyond tone
- **Location:** `artifacts/api-server/src/lib/lens-policy.ts`, `artifacts/api-server/src/services/lens-routing-service.ts`, `artifacts/api-server/src/services/context-retrieval-service.ts`

---

## Retrieval Engine

- **Purpose:** Executes governed, secure knowledge search within the active lens membrane
- **Version:** retrieval-policy-v1.2
- **Completion:** ~85%
- **Implemented:** OR-based FTS (lexeme union), question-filler-word stripping, hybrid scoring, partition security, sensitivity ceiling, MAX_CHUNKS_PER_ASSET=4, MAX_ASSET_FRACTION=0.6, near-duplicate suppression, safe tag-based fallback, per-request retrieval traces with 8 provenance columns
- **Missing:** Vector semantic search, embedding model integration, hybrid FTS+vector approach
- **Location:** `artifacts/api-server/src/services/knowledge-search-service.ts`, `artifacts/api-server/src/config/retrieval-policy.ts`

---

## Development Orchestrator

- **Purpose:** AI-driven development task management with review, approval and repository tracking
- **Version:** dev-orchestrator-v1
- **Completion:** ~60%
- **Implemented:** Task CRUD, AI run tracking, review findings, change proposals, approval workflow, repository references, audit events; admin-only route guard
- **Missing:** Automated PR generation, GitHub API integration, automated test-gating on proposals, AI-driven code review
- **Location:** `artifacts/api-server/src/routes/development.ts`, `lib/db/src/schema/development.ts`
- **Dependencies:** PostgreSQL, Anthropic Claude, (planned) GITHUB_TOKEN

---

## Document Engine

- **Purpose:** Produces structured documents (proposals, SoWs, RFP responses) from governed knowledge
- **Version:** rfp-v1 (partial)
- **Completion:** ~35%
- **Implemented:** RFP/RFI document decomposition, section-based drafting with SSE streaming, requirements extraction, quality review pipeline, document assembly, in-memory store with 4-hour TTL
- **Missing:** Persistent document storage, generalised proposal generation, staged generation with timeout safety, SoW generation as standalone pipeline
- **Location:** `artifacts/api-server/src/routes/rfp.ts`, `artifacts/api-server/prompts/`
- **Next Milestone:** Staged proposal generation (timeout-safe) — active priority

---

## Memory Engine

- **Purpose:** Maintains persistent context about opportunities, organisations and users across sessions
- **Version:** Not yet active
- **Completion:** ~10% (schema only)
- **Implemented:** opportunitiesTable, contactsTable, opportunityEventsTable, opportunityWorkingStateTable defined; basic opportunity CRUD in runtime schema
- **Missing:** Memory integration into conversation context, memory retrieval service, working memory vs long-term memory distinction
- **Location:** `lib/db/src/schema/runtime.ts`, `artifacts/api-server/src/services/opportunities-service.ts`

---

## Learning Engine

- **Purpose:** Captures feedback signals and improves knowledge and responses over time
- **Version:** Not yet active
- **Completion:** ~10% (schema only)
- **Implemented:** learningOutcomesTable, aiRunsTable defined
- **Missing:** Feedback capture UI, outcome classification, knowledge proposal generation from feedback, human approval gate for knowledge changes
- **Location:** `lib/db/src/schema/development.ts`

---

## Approval Engine

- **Purpose:** Human-in-the-loop gate for AI-proposed changes to knowledge, architecture and communications
- **Version:** Not yet active
- **Completion:** ~10% (schema only)
- **Implemented:** approvalsTable, changeProposalsTable defined; development route accepts approval submissions
- **Missing:** Approval UI, notification system, approval state machine, governance enforcement
- **Location:** `lib/db/src/schema/development.ts`

---

## Planned Engines (Not Started)

- **Reasoning Engine** — Structured multi-step reasoning for complex analysis
- **Agent Orchestrator** — Coordinates multiple specialist agents across a workflow
- **Automation Engine** — Scheduled, triggered, and event-driven task execution
- **Presentation Engine** — Generates slide decks and visual documents

---

_All engine locations are within the monorepo at the paths listed above._

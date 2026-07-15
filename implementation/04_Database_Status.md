# Database Status
## 04_Database_Status.md
Generated: 2026-07-15 13:37:27 UTC

---

## Summary

| Metric | Value |
|---|---|
| Total tables | 21 |
| Schema files | 6 |
| ORM | Drizzle ORM |
| Driver | pg (node-postgres) |
| Database | PostgreSQL (Replit-managed) |
| Migration tool | Drizzle Kit push |

---

## Schema Files and Tables

### auth.ts

- `sessions`
- `users`

### conversations.ts

- `conversations`
- `messages`

### runtime.ts

- `organisations`
- `org_memberships`
- `opportunities`
- `contacts`
- `opportunity_events`
- `opportunity_working_state`
- `audit_events`

### development.ts

- `development_tasks`
- `ai_runs`
- `review_findings`
- `change_proposals`
- `approvals`
- `repository_references`
- `learning_outcomes`
- `development_audit_events`

### knowledge-chunks.ts

- `knowledge_chunks`

### retrieval-traces.ts

- `retrieval_traces`

---

## Table Classification

| Table | Domain | Notes |
|---|---|---|
| sessions | Auth | OIDC session store |
| users | Auth | Platform user identity |
| organisations | Runtime | Multi-tenant org |
| org_memberships | Runtime | User ↔ Org with role |
| opportunities | Runtime | Sales opportunity tracking |
| contacts | Runtime | Opportunity contacts |
| opportunity_events | Runtime | Event log per opportunity |
| opportunity_working_state | Runtime | Mutable working state |
| audit_events | Runtime | Governed audit trail |
| conversations | Conversations | Multi-turn conversation |
| messages | Conversations | Individual messages with metadata |
| knowledge_chunks | Knowledge | Indexed content chunks |
| retrieval_traces | Knowledge | Per-message retrieval provenance |
| development_tasks | Development | AI task management |
| ai_runs | Development | AI reasoning run log |
| review_findings | Development | Code/arch review outcomes |
| change_proposals | Development | Proposed changes |
| approvals | Development | Human approval records |
| repository_references | Development | File/commit citations |
| learning_outcomes | Development | Learning signal capture |
| development_audit_events | Development | Dev workflow audit trail |

---

## Knowledge Chunks Schema Highlights

- `asset_id` — FK to manifest asset ID
- `chunk_index` — Position within asset
- `heading_path` — Slash-delimited heading hierarchy
- `content` — Text content
- `content_hash` — SHA-256 for change detection
- `token_estimate` — Character-based token estimate
- `partition` — neutral / intelligence / commercial / delivery / restricted
- `sensitivity` — public / internal / confidential / restricted
- `verification_state` — draft / approved / superseded
- `evidence_tier` — governed / established / current / observed / unverified
- `tags` — text[] for tag-based fallback search
- Indexes: partition, sensitivity, evidence_tier, unique(asset_id, chunk_index)

---

## Retrieval Traces Schema Highlights

- `conversation_id`, `message_id` — Links trace to conversation message
- `active_lens` — Lens in force at retrieval time
- `policy_version` — Retrieval policy version at time of search
- `retrieval_policy_version`, `chunk_policy_version` — Policy version audit
- `user_query`, `enriched_query` — Query before and after vocabulary expansion
- `score_summaries` — JSONB array of {chunkId, assetId, score, evidenceTier}
- `no_result`, `used_tag_fallback` — Outcome flags
- `search_latency_ms` — Performance metric

---

## Database Maturity

- **Auth tables:** Production
- **Conversations:** Production
- **Knowledge:** Production
- **Runtime (org/opportunity):** Implemented; limited API surface
- **Development:** Implemented; approval pipeline partial
- **Migrations:** Push-based via Drizzle Kit (`pnpm --filter @workspace/db run push-force`)

---

_All schema definitions are in `lib/db/src/schema/`. Run `pnpm run typecheck:libs` after any schema change before leaf artifact typechecks._

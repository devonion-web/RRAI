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
# Database Status
## 04_Database_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Total tables | 21 |
| Schema files | 6 |
| ORM | Drizzle ORM + pg driver |
| Database | PostgreSQL (Replit-managed) |
| Migration tool | Drizzle Kit push |

---

## Tables by Schema File

### auth.ts

- `sessions`
- `users`

### conversations.ts

- `conversations`
- `messages`

### development.ts

- `ai_runs`
- `approvals`
- `change_proposals`
- `development_audit_events`
- `development_tasks`
- `learning_outcomes`
- `repository_references`
- `review_findings`

### knowledge-chunks.ts

- `knowledge_chunks`

### retrieval-traces.ts

- `retrieval_traces`

### runtime.ts

- `audit_events`
- `contacts`
- `opportunities`
- `opportunity_events`
- `opportunity_working_state`
- `org_memberships`
- `organisations`

---

## Table Classification

| Table | Schema File | Domain |
| --- | --- | --- |
| `sessions` | auth | Auth |
| `users` | auth | Auth |
| `conversations` | conversations | Conversation |
| `messages` | conversations | Conversation |
| `ai_runs` | development | Development |
| `approvals` | development | Development |
| `change_proposals` | development | Development |
| `development_audit_events` | development | Development |
| `development_tasks` | development | Development |
| `learning_outcomes` | development | Development |
| `repository_references` | development | Development |
| `review_findings` | development | Development |
| `knowledge_chunks` | knowledge-chunks | Knowledge |
| `retrieval_traces` | retrieval-traces | Knowledge |
| `audit_events` | runtime | Runtime |
| `contacts` | runtime | Runtime |
| `opportunities` | runtime | Runtime |
| `opportunity_events` | runtime | Runtime |
| `opportunity_working_state` | runtime | Runtime |
| `org_memberships` | runtime | Runtime |
| `organisations` | runtime | Runtime |

---

## Knowledge Chunks Schema Highlights

- `asset_id` — FK to manifest asset ID
- `chunk_index` — Position within asset
- `heading_path` — Slash-delimited heading hierarchy
- `content` — Text content
- `content_hash` — SHA-256 for change detection
- `partition` — neutral / intelligence / commercial / delivery / restricted
- `sensitivity` — public / internal / confidential / restricted
- `verification_state` — draft / approved / superseded
- `evidence_tier` — governed / established / current / observed / unverified
- Indexes: partition, sensitivity, evidence_tier, unique(asset_id, chunk_index)

---

## Retrieval Traces Schema Highlights

- `conversation_id`, `message_id` — Links trace to conversation message
- `active_lens` — Lens in force at retrieval time
- `policy_version` — Retrieval policy version at time of search
- `user_query`, `enriched_query` — Before and after vocabulary expansion
- `score_summaries` — JSONB array of {chunkId, assetId, score, evidenceTier}
- `no_result`, `used_tag_fallback` — Outcome flags
- `search_latency_ms` — Performance metric

---

_Table names are extracted from `pgTable()` declarations in `lib/db/src/schema/*.ts`. Schema files are the authoritative definition; Drizzle Kit push applies migrations._

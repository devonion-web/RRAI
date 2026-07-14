# Phase 2 — Database Foundation Specification

Status: Specification only — do not implement until approved.
Date: 14 July 2026
Authority: Governed by `architecture/00_RRAI_Master_Context_v2_0.md` and `architecture/11 Database Principles.md`

---

## Separation of Concerns

This specification separates four distinct data domains. No domain may write directly into another's tables.

| Domain | Definition | Examples | Write authority |
|---|---|---|---|
| **Governed Knowledge** | Approved, versioned, organisation-level intelligence. Never mutated at runtime. | Risk Rising profile, LogicGate product knowledge, industry frameworks | Human-approved only |
| **Runtime Memory** | Session and opportunity state created during use. Short-to-medium lived. | Conversations, messages, opportunity context, contact notes | Application |
| **Uploaded Documents** | Files provided by users. Metadata tracked; content extracted and discarded or stored ephemerally. | RFP documents, bid packs, meeting transcripts | Application (upload event) |
| **Generated Artefacts** | Outputs produced by AI. Derived, never source of truth. | Draft proposals, SoWs, meeting summaries, scored requirements | Application (derived, flagged as unverified) |

---

## Entities

### 1. organisations

Scope: Governed Knowledge layer — one row per organisation using the platform.

```
organisations
  id                uuid            PK
  name              text            NOT NULL
  slug              text            UNIQUE NOT NULL
  domain            text
  created_at        timestamptz     NOT NULL DEFAULT now()
  updated_at        timestamptz     NOT NULL DEFAULT now()
```

Relationships: All other entities reference `organisation_id`. This is the root tenancy boundary.

---

### 2. opportunities

Scope: Runtime Memory — a sales or delivery opportunity being tracked by an executive.

```
opportunities
  id                uuid            PK
  organisation_id   uuid            FK → organisations.id   NOT NULL
  name              text            NOT NULL
  status            text            NOT NULL   -- e.g. active, closed, archived
  vendor_name       text                       -- target vendor/prospect
  value_estimate    numeric(12,2)
  currency          char(3)         DEFAULT 'GBP'
  created_at        timestamptz     NOT NULL DEFAULT now()
  updated_at        timestamptz     NOT NULL DEFAULT now()
  closed_at         timestamptz
```

Notes:
- `value_estimate` and commercial fields are Runtime Memory. They must not be exposed to Analyst-lens reasoning (one-way-valve rule).
- Status transitions should write to `audit_events`.

---

### 3. conversations

Scope: Runtime Memory — a session thread between an executive and a capability/engine.

```
conversations
  id                uuid            PK
  organisation_id   uuid            FK → organisations.id   NOT NULL
  opportunity_id    uuid            FK → opportunities.id   NULLABLE  -- null = not opportunity-scoped
  title             text
  lens              text            NOT NULL   -- e.g. analyst, commercial, delivery
  capability        text                       -- e.g. logicgate, rfp, research
  status            text            NOT NULL DEFAULT 'active'   -- active, archived
  created_at        timestamptz     NOT NULL DEFAULT now()
  updated_at        timestamptz     NOT NULL DEFAULT now()
```

Notes:
- `lens` is mandatory. Every conversation is lens-scoped; cross-lens data access is prohibited at the application layer.
- `opportunity_id` nullable: some conversations are executive-wide (research, planning), not opportunity-specific.

---

### 4. messages

Scope: Runtime Memory — individual turns within a conversation.

```
messages
  id                uuid            PK
  conversation_id   uuid            FK → conversations.id   NOT NULL
  role              text            NOT NULL   -- user | assistant | system
  content           text            NOT NULL
  model             text                       -- AI model used (assistant messages only)
  tokens_in         int
  tokens_out        int
  created_at        timestamptz     NOT NULL DEFAULT now()
```

Notes:
- Messages are append-only. No updates permitted.
- `role = system` rows record the active system prompt at the time of the message, supporting future prompt auditing.
- Token counts support cost attribution per conversation.

---

### 5. uploaded_documents

Scope: Uploaded Documents — metadata only. Extracted content stored ephemerally (not in this table).

```
uploaded_documents
  id                uuid            PK
  organisation_id   uuid            FK → organisations.id   NOT NULL
  opportunity_id    uuid            FK → opportunities.id   NULLABLE
  conversation_id   uuid            FK → conversations.id   NULLABLE
  filename          text            NOT NULL
  mime_type         text            NOT NULL
  size_bytes        bigint
  parse_status      text            NOT NULL DEFAULT 'pending'  -- pending, extracted, failed, expired
  sensitivity       text            NOT NULL DEFAULT 'internal' -- public, internal, confidential, restricted
  uploaded_at       timestamptz     NOT NULL DEFAULT now()
  expired_at        timestamptz                -- set when ephemeral content purged
  uploaded_by       uuid                       -- FK → users.id when auth exists
```

Notes:
- Raw file content is NOT stored in the database. It is parsed on upload and held ephemerally per the current `docStore.ts` pattern, then discarded.
- `sensitivity` classification must be assigned at upload time (write-time classification principle).
- This table records that a document was processed; it never becomes a knowledge source unless explicitly promoted to `knowledge_assets` by a human-approved action.

---

### 6. knowledge_assets

Scope: Governed Knowledge — the master-asset registry. Records approved, versioned knowledge items.

```
knowledge_assets
  id                uuid            PK
  organisation_id   uuid            FK → organisations.id   NOT NULL
  title             text            NOT NULL
  slug              text            NOT NULL
  domain            text            NOT NULL   -- e.g. vendor, regulatory, framework, industry
  sensitivity       text            NOT NULL DEFAULT 'internal'
  version           int             NOT NULL DEFAULT 1
  status            text            NOT NULL DEFAULT 'draft'  -- draft, approved, superseded, archived
  content_hash      text                       -- SHA-256 of approved content; detects drift
  approved_by       uuid                       -- FK → users.id when auth exists
  approved_at       timestamptz
  created_at        timestamptz     NOT NULL DEFAULT now()
  updated_at        timestamptz     NOT NULL DEFAULT now()
```

```
knowledge_asset_versions
  id                uuid            PK
  asset_id          uuid            FK → knowledge_assets.id   NOT NULL
  version           int             NOT NULL
  content           text            NOT NULL   -- governed source text
  change_summary    text
  authored_by       uuid
  approved_by       uuid
  approved_at       timestamptz
  created_at        timestamptz     NOT NULL DEFAULT now()
```

Notes:
- Only rows with `status = approved` may be used in retrieval.
- `knowledge_assets` is the master-asset registry required by `architecture/07 Memory Architecture.md`.
- Generated chunks, embeddings and vector index entries derived from this table live in `knowledge/generated/` (filesystem) or a future vector store — never promoted back into this table.
- Content changes require a new version row and human re-approval.

---

### 7. audit_events

Scope: Cross-cutting — records consequential events for compliance and review.

```
audit_events
  id                uuid            PK
  organisation_id   uuid            FK → organisations.id   NOT NULL
  actor_type        text            NOT NULL   -- user | system | agent
  actor_id          uuid                       -- FK → users.id when auth exists; null for system events
  event_type        text            NOT NULL   -- e.g. opportunity.status_changed, knowledge.approved, document.uploaded
  entity_type       text                       -- e.g. opportunity, knowledge_asset, conversation
  entity_id         uuid
  payload           jsonb                      -- event-specific structured data
  lens              text                       -- lens active at time of event
  created_at        timestamptz     NOT NULL DEFAULT now()
```

Notes:
- Append-only. No updates or deletes.
- `payload` is JSONB to accommodate varied event types without schema churn.
- This table replaces the current ad-hoc in-memory audit log in `bidPackStore.ts`.

---

## Entity Relationship Summary

```
organisations
  └── opportunities
  └── conversations ──→ opportunities (optional)
  └── uploaded_documents ──→ opportunities (optional), conversations (optional)
  └── knowledge_assets
        └── knowledge_asset_versions

conversations
  └── messages (append-only)

audit_events (references any entity by type + id)
```

---

## Domain boundary rules

| Rule | Enforced by |
|---|---|
| `knowledge_assets` rows require `status = approved` to be used in retrieval | Application layer (query filter) |
| `uploaded_documents` content is never stored in the database | Application layer (no content column) |
| Generated artefacts (AI output) are not persisted in any of the above tables | Application layer — stored in messages.content or discarded |
| `lens` on a conversation must match the `lens` of any knowledge retrieved during that conversation | Application layer (retrieval-time filter) |
| Commercial fields in `opportunities` must not be passed to Analyst-lens prompts | Application layer (prompt assembly) |
| All `audit_events` rows are immutable | Database constraint (no UPDATE/DELETE privileges on this table) |

---

## Migration risks

| Risk | Severity | Mitigation |
|---|---|---|
| Existing in-memory opportunity/contact data lost on first migration | Medium | Export in-memory state to seed file before enabling DB persistence; in practice current data is ephemeral anyway |
| Drizzle schema conflicts with empty existing schema | Low | Schema file is currently empty — no conflict, safe to populate |
| `uploaded_documents` sensitivity classification is manual initially | Medium | Default to `internal`; add classification workflow in a later phase |
| No `users` table yet (auth not implemented) | High | All `actor_id` and `uploaded_by` columns nullable until auth phase; audit events use `actor_type = system` until then |
| Knowledge asset approval workflow requires a user model | High | `knowledge_assets.approved_by` nullable until auth phase; no knowledge can be formally approved until auth lands |

---

## Recommended next implementation action

**Implement the `users` / authentication layer first, before the database schema.**

Reason: four of the seven entities above have nullable FK columns waiting for `users.id`. Populating the schema without users means `audit_events`, `knowledge_assets`, and `uploaded_documents` cannot attribute any action to a human actor. The audit trail will be structurally incomplete from day one. Authentication is therefore the correct dependency to resolve before data persistence is switched on.

This aligns with `architecture/13 Security & Governance.md`.

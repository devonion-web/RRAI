/**
 * RFP Work Item schema — Phase 1: Persistent Work Item Foundation.
 *
 * Tables
 * ──────
 *   rfp_work_items       — root Work Item (pack + engagement profile inline)
 *   rfp_documents        — uploaded/pasted documents with extracted text
 *   rfp_requirements     — decomposed requirements from bid documents
 *   rfp_responses        — per-requirement response envelope (status, lens)
 *   rfp_response_blocks  — individual answer blocks within a response
 *   rfp_quality_reviews  — LLM and deterministic quality gate results (append-only via repo)
 *   rfp_audit_events     — immutable event log (append-only via repo; no update/delete)
 *
 * Tenancy
 * ───────
 *   org_id and created_by_user_id reference existing tables where present.
 *   Both are nullable: authenticated users without a resolved organisation can
 *   still create Work Items (the auth middleware enforces login; org resolution
 *   is best-effort at this stage). No row-level security is enforced by the DB
 *   itself in Phase 1 — access control remains at the application layer.
 *
 * Cascade policy
 * ──────────────
 *   work_item deletion → cascade to all child rows.
 *   requirement deletion → cascade to responses and blocks; set NULL on
 *   quality_reviews.requirement_id and audit_events.requirement_id so
 *   historical records survive.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organisationsTable } from "./runtime";

// ── Work Items ────────────────────────────────────────────────────────────────

export const rfpWorkItemsTable = pgTable(
  "rfp_work_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tenancy: nullable because early sessions may not have a resolved org.
    // Access control is enforced at the application layer (rfpRepository).
    orgId: uuid("org_id").references(() => organisationsTable.id, {
      onDelete: "set null",
    }),
    createdByUserId: varchar("created_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),

    name: text("name").notNull(),
    buyerName: text("buyer_name").notNull(),

    // Always "commercial" for this workflow. Stored explicitly so the DB
    // record is self-describing and future lenses can be added without schema
    // changes.
    lens: text("lens").notNull().default("commercial"),

    workflowStage: text("workflow_stage").notNull().default("decompose"),
    status: text("status").notNull().default("active"),

    // Full extracted + concatenated document text — required for AI prompt
    // injection in decompose, validate-decomp and validate-final routes.
    parsedContent: text("parsed_content").notNull().default(""),

    // Engagement profile stored inline as jsonb. Avoids a separate table
    // for Phase 1 while preserving the ability to normalise later.
    profile: jsonb("profile"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("rfp_work_items_org_id_idx").on(t.orgId),
    index("rfp_work_items_created_by_idx").on(t.createdByUserId),
    index("rfp_work_items_status_idx").on(t.status),
    index("rfp_work_items_created_at_idx").on(t.createdAt),
  ],
);

export type RfpWorkItem = typeof rfpWorkItemsTable.$inferSelect;
export type InsertRfpWorkItem = typeof rfpWorkItemsTable.$inferInsert;

// ── Documents ─────────────────────────────────────────────────────────────────

export const rfpDocumentsTable = pgTable(
  "rfp_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => rfpWorkItemsTable.id, { onDelete: "cascade" }),

    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull().default("text/plain"),
    fileSizeBytes: integer("file_size_bytes"),
    characterCount: integer("character_count").notNull().default(0),

    // Text documents (PDF, Word, pasted text, plain text)
    extractedText: text("extracted_text"),

    // Structured documents (Excel / spreadsheet rows)
    structuredContent: jsonb("structured_content"),

    // "extracted" | "failed" | "pending"
    extractionStatus: text("extraction_status").notNull().default("extracted"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rfp_documents_work_item_id_idx").on(t.workItemId),
    index("rfp_documents_created_at_idx").on(t.createdAt),
  ],
);

export type RfpDocument = typeof rfpDocumentsTable.$inferSelect;
export type InsertRfpDocument = typeof rfpDocumentsTable.$inferInsert;

// ── Requirements ──────────────────────────────────────────────────────────────

export const rfpRequirementsTable = pgTable(
  "rfp_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => rfpWorkItemsTable.id, { onDelete: "cascade" }),

    // Self-reference: child requirements reference their parent. Nullable FK
    // uses SET NULL on parent delete so orphaned children survive.
    parentRequirementId: uuid("parent_requirement_id"),

    requirementCode: text("requirement_code").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    title: text("title").notNull(),
    sourceText: text("source_text").notNull().default(""),
    scoringWeight: text("scoring_weight"),

    minimumExpectations: jsonb("minimum_expectations")
      .notNull()
      .$type<string[]>()
      .default([]),
    considerations: jsonb("considerations")
      .notNull()
      .$type<string[]>()
      .default([]),
    mandatedStructure: text("mandated_structure"),

    // "RR" | "LogicGate" | "shared" | "M&S"
    responseResponsibility: text("response_responsibility")
      .notNull()
      .default("shared"),
    responsibilityRationale: text("responsibility_rationale")
      .notNull()
      .default(""),
    responsibilityConfirmed: boolean("responsibility_confirmed")
      .notNull()
      .default(false),
    // "low" | "medium" | "high"
    responsibilityConfidence: text("responsibility_confidence"),

    // "pending" | "validating" | "passed" | "failed"
    responseStage: text("response_stage").notNull().default("pending"),

    crossCuttingConstraints: jsonb("cross_cutting_constraints")
      .notNull()
      .$type<Array<{ type: string; text: string }>>()
      .default([]),

    rewriteAttempts: integer("rewrite_attempts").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("rfp_requirements_work_item_id_idx").on(t.workItemId),
    index("rfp_requirements_response_stage_idx").on(t.responseStage),
    index("rfp_requirements_display_order_idx").on(t.workItemId, t.displayOrder),
  ],
);

export type RfpRequirement = typeof rfpRequirementsTable.$inferSelect;
export type InsertRfpRequirement = typeof rfpRequirementsTable.$inferInsert;

// ── Responses ─────────────────────────────────────────────────────────────────

export const rfpResponsesTable = pgTable(
  "rfp_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => rfpWorkItemsTable.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => rfpRequirementsTable.id, { onDelete: "cascade" }),

    // "draft" | "in_review" | "approved"
    status: text("status").notNull().default("draft"),
    lens: text("lens").notNull().default("commercial"),
    openDependencies: jsonb("open_dependencies")
      .notNull()
      .$type<string[]>()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // One response per requirement — enforced at DB level.
    unique("rfp_responses_requirement_id_uq").on(t.requirementId),
    index("rfp_responses_work_item_id_idx").on(t.workItemId),
    index("rfp_responses_status_idx").on(t.status),
  ],
);

export type RfpResponse = typeof rfpResponsesTable.$inferSelect;
export type InsertRfpResponse = typeof rfpResponsesTable.$inferInsert;

// ── Response blocks ───────────────────────────────────────────────────────────

export const rfpResponseBlocksTable = pgTable(
  "rfp_response_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => rfpResponsesTable.id, { onDelete: "cascade" }),

    blockKey: text("block_key").notNull(),
    // "minimum" | "enrichment"
    blockType: text("block_type").notNull().default("minimum"),
    promptText: text("prompt_text"),
    answer: text("answer").notNull().default(""),

    // Placeholder[] — [{id, description, group, value, filled}]
    placeholders: jsonb("placeholders")
      .notNull()
      .$type<Array<Record<string, unknown>>>()
      .default([]),

    reviewed: boolean("reviewed").notNull().default(false),

    // "pending" | "passed" | "failed" | "rewriting" | null
    validationStatus: text("validation_status"),
    validationFindings: jsonb("validation_findings")
      .notNull()
      .$type<string[]>()
      .default([]),
    rewriteAttempts: integer("rewrite_attempts").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // One block per key per response.
    unique("rfp_response_blocks_response_key_uq").on(t.responseId, t.blockKey),
    index("rfp_response_blocks_response_id_idx").on(t.responseId),
  ],
);

export type RfpResponseBlock = typeof rfpResponseBlocksTable.$inferSelect;
export type InsertRfpResponseBlock =
  typeof rfpResponseBlocksTable.$inferInsert;

// ── Quality reviews ───────────────────────────────────────────────────────────

export const rfpQualityReviewsTable = pgTable(
  "rfp_quality_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => rfpWorkItemsTable.id, { onDelete: "cascade" }),

    // Nullable FKs: SET NULL so reviews survive when the referenced row is
    // deleted (e.g. re-decompose).
    requirementId: uuid("requirement_id").references(
      () => rfpRequirementsTable.id,
      { onDelete: "set null" },
    ),
    responseId: uuid("response_id").references(() => rfpResponsesTable.id, {
      onDelete: "set null",
    }),

    // "decomposition" | "ownership" | "response" | "final"
    reviewType: text("review_type").notNull(),

    // "pack" | "requirement" | "response" | "block" — matches bidPackStore QR
    targetType: text("target_type").notNull().default("pack"),
    // ID of the target entity (pack ID, req ID, etc.)
    targetId: text("target_id").notNull().default(""),

    score: numeric("score"),
    passed: boolean("passed"),

    findings: jsonb("findings").notNull().$type<string[]>().default([]),
    missingItems: jsonb("missing_items")
      .notNull()
      .$type<string[]>()
      .default([]),
    recommendedActions: jsonb("recommended_actions")
      .notNull()
      .$type<string[]>()
      .default([]),
    checks: jsonb("checks")
      .notNull()
      .$type<Record<string, boolean>>()
      .default({}),

    overridden: boolean("overridden").notNull().default(false),
    overrideReason: text("override_reason"),
    overrideActor: text("override_actor"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rfp_quality_reviews_work_item_id_idx").on(t.workItemId),
    index("rfp_quality_reviews_requirement_id_idx").on(t.requirementId),
    index("rfp_quality_reviews_review_type_idx").on(t.reviewType),
    index("rfp_quality_reviews_created_at_idx").on(t.createdAt),
  ],
);

export type RfpQualityReview = typeof rfpQualityReviewsTable.$inferSelect;
export type InsertRfpQualityReview =
  typeof rfpQualityReviewsTable.$inferInsert;

// ── Audit events ──────────────────────────────────────────────────────────────
// Append-only. The rfpRepository exposes no update or delete method for this
// table. A partial DB-level guard is provided by the absence of update columns
// and by the repository contract. Full immutability enforcement (trigger-based)
// is deferred to Phase 2.

export const rfpAuditEventsTable = pgTable(
  "rfp_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => rfpWorkItemsTable.id, { onDelete: "cascade" }),

    // Nullable: events may or may not relate to a specific requirement.
    requirementId: uuid("requirement_id").references(
      () => rfpRequirementsTable.id,
      { onDelete: "set null" },
    ),

    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),

    // "user" | "system" | "RRAI"
    actorType: text("actor_type").notNull().default("system"),
    actorId: text("actor_id"),
    actorLabel: text("actor_label"),

    payload: jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),

    // No updated_at — immutable once written.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rfp_audit_events_work_item_id_idx").on(t.workItemId),
    index("rfp_audit_events_requirement_id_idx").on(t.requirementId),
    index("rfp_audit_events_event_type_idx").on(t.eventType),
    index("rfp_audit_events_created_at_idx").on(t.createdAt),
  ],
);

export type RfpAuditEvent = typeof rfpAuditEventsTable.$inferSelect;
export type InsertRfpAuditEvent = typeof rfpAuditEventsTable.$inferInsert;

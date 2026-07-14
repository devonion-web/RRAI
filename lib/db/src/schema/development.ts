import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  real,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Controlled-value sets (exported for use in service / tests) ───────────────

export const TASK_TYPES = [
  "architecture",
  "knowledge",
  "engineering",
  "implementation",
  "review",
  "remediation",
] as const;

export const TASK_STATUSES = [
  "proposed",
  "approved_to_start",
  "drafting",
  "under_review",
  "refinement_required",
  "awaiting_human_approval",
  "approved",
  "rejected",
  "ready_for_implementation",
  "implemented",
  "verified",
  "released",
  "archived",
] as const;

export const ASSIGNED_ROLES = [
  "product_owner",
  "architect",
  "author",
  "implementer",
  "reviewer",
  "validator",
  "orchestrator",
] as const;

export const PROVIDERS = ["anthropic", "openai", "replit", "human"] as const;
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const APPROVAL_CLASSES = [
  "architecture_change",
  "knowledge_change",
  "merge_to_main",
  "release_to_production",
  "external_publication",
  "customer_commitment",
  "pricing_or_terms",
  "legal_regulatory",
] as const;

export const APPROVAL_DECISIONS = ["approved", "rejected", "deferred"] as const;
export const VERIFICATION_STATES = ["unverified", "human_reviewed", "promoted"] as const;
export const PROPOSAL_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "implemented",
  "superseded",
] as const;
export const REPO_STATES = ["pending", "open", "merged", "closed", "abandoned"] as const;
export const FINDING_SEVERITIES = ["info", "warning", "error", "blocker"] as const;
export const FINDING_CATEGORIES = [
  "architecture",
  "implementation",
  "governance",
  "security",
  "conformance",
] as const;
export const RESOLUTION_STATUSES = ["open", "acknowledged", "resolved", "wont_fix"] as const;
export const OUTCOME_TYPES = [
  "process",
  "architecture",
  "implementation",
  "knowledge",
  "review",
] as const;
export const RUN_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export const ACTOR_TYPES = ["human", "ai_model", "system"] as const;
export const PROPOSAL_TYPES = [
  "architecture",
  "knowledge",
  "implementation",
  "configuration",
] as const;
export const REVIEWER_ROLES = [
  "architect",
  "implementer",
  "reviewer",
  "validator",
  "human",
] as const;

// ── Tables ────────────────────────────────────────────────────────────────────

export const developmentTasksTable = pgTable("development_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(),
  status: text("status").notNull().default("proposed"),
  riskLevel: text("risk_level").notNull().default("low"),
  sourceType: text("source_type"),
  sourceReference: text("source_reference"),
  assignedRole: text("assigned_role"),
  governingDocumentReferences: text("governing_document_references").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const aiRunsTable = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  role: text("role").notNull(),
  inputReference: text("input_reference"),
  outputContent: text("output_content"),
  status: text("status").notNull().default("pending"),
  tokenUsage: jsonb("token_usage"),
  costMetadata: jsonb("cost_metadata"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewFindingsTable = pgTable("review_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  aiRunId: uuid("ai_run_id").references(() => aiRunsTable.id),
  reviewerRole: text("reviewer_role").notNull(),
  severity: text("severity").notNull(),
  category: text("category").notNull(),
  finding: text("finding").notNull(),
  recommendation: text("recommendation"),
  resolutionStatus: text("resolution_status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const changeProposalsTable = pgTable("change_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  proposalType: text("proposal_type").notNull(),
  targetPaths: text("target_paths").array(),
  summary: text("summary").notNull(),
  proposedPatchReference: text("proposed_patch_reference"),
  status: text("status").notNull().default("draft"),
  requiresHumanApproval: boolean("requires_human_approval").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const approvalsTable = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  changeProposalId: uuid("change_proposal_id").references(() => changeProposalsTable.id),
  approvalClass: text("approval_class").notNull(),
  decision: text("decision").notNull(),
  decidedBy: uuid("decided_by"),
  decidedByLabel: text("decided_by_label"),
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repositoryReferencesTable = pgTable("repository_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  repository: text("repository").notNull().default("devonion-web/RRAI"),
  baseBranch: text("base_branch").notNull().default("develop"),
  featureBranch: text("feature_branch"),
  commitSha: text("commit_sha"),
  pullRequestNumber: integer("pull_request_number"),
  pullRequestUrl: text("pull_request_url"),
  state: text("state").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const learningOutcomesTable = pgTable("learning_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id")
    .notNull()
    .references(() => developmentTasksTable.id),
  outcomeType: text("outcome_type").notNull(),
  result: text("result").notNull(),
  humanFeedback: text("human_feedback"),
  candidateLesson: text("candidate_lesson"),
  confidence: real("confidence"),
  verificationState: text("verification_state").notNull().default("unverified"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const developmentAuditEventsTable = pgTable("development_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  developmentTaskId: uuid("development_task_id").references(() => developmentTasksTable.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: uuid("actor_id"),
  actorLabel: text("actor_label"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Insert schemas (Zod validation) ──────────────────────────────────────────

export const insertDevelopmentTaskSchema = createInsertSchema(developmentTasksTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    taskType: z.enum(TASK_TYPES),
    status: z.enum(TASK_STATUSES).optional(),
    riskLevel: z.enum(RISK_LEVELS).optional(),
    assignedRole: z.enum(ASSIGNED_ROLES).optional(),
  });

export const insertReviewFindingSchema = createInsertSchema(reviewFindingsTable)
  .omit({ id: true, createdAt: true })
  .extend({
    reviewerRole: z.enum(REVIEWER_ROLES),
    severity: z.enum(FINDING_SEVERITIES),
    category: z.enum(FINDING_CATEGORIES),
    resolutionStatus: z.enum(RESOLUTION_STATUSES).optional(),
  });

export const insertApprovalSchema = createInsertSchema(approvalsTable)
  .omit({ id: true, decidedAt: true })
  .extend({
    approvalClass: z.enum(APPROVAL_CLASSES),
    decision: z.enum(APPROVAL_DECISIONS),
  });

// ── Inferred types ────────────────────────────────────────────────────────────

export type DevelopmentTask = typeof developmentTasksTable.$inferSelect;
export type InsertDevelopmentTask = z.infer<typeof insertDevelopmentTaskSchema>;
export type AiRun = typeof aiRunsTable.$inferSelect;
export type ReviewFinding = typeof reviewFindingsTable.$inferSelect;
export type InsertReviewFinding = z.infer<typeof insertReviewFindingSchema>;
export type ChangeProposal = typeof changeProposalsTable.$inferSelect;
export type Approval = typeof approvalsTable.$inferSelect;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type RepositoryReference = typeof repositoryReferencesTable.$inferSelect;
export type LearningOutcome = typeof learningOutcomesTable.$inferSelect;
export type DevelopmentAuditEvent = typeof developmentAuditEventsTable.$inferSelect;

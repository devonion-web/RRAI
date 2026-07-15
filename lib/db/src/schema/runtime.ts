import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  numeric,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ── Organisations ─────────────────────────────────────────────────────────────
// Root tenancy boundary. All runtime data references an organisation.
// For the current single-company deployment, one row is bootstrapped on
// server startup: slug = RRAI_ORG_SLUG (default "risk-rising").
export const organisationsTable = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ── Organisation memberships ──────────────────────────────────────────────────
// Associates authenticated users with organisations.
// role = "member" | "admin"  — distinct from platform role on usersTable.
// Membership is granted server-side only (never from client payload).
export const orgMembershipsTable = pgTable(
  "org_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("org_memberships_org_user_uq").on(table.organisationId, table.userId),
    index("org_memberships_user_id_idx").on(table.userId),
    index("org_memberships_org_id_idx").on(table.organisationId),
  ],
);

// ── Opportunities ─────────────────────────────────────────────────────────────
// Runtime Memory — sales/delivery opportunities tracked per organisation.
// metadata JSONB preserves any LogicGate workflow fields not yet normalised.
export const opportunitiesTable = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),
    ownerUserId: varchar("owner_user_id").references(() => usersTable.id),

    // Core fields — maps to LogicGate's `company` field
    name: text("name").notNull(),
    customerName: text("customer_name"),
    status: text("status").notNull().default("active"),
    stage: text("stage"),
    source: text("source"),
    summary: text("summary"),

    // Commercial (Runtime Memory — must not be passed to Analyst-lens prompts)
    currency: varchar("currency", { length: 3 }).default("GBP"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
    probability: numeric("probability", { precision: 5, scale: 2 }),
    targetCloseDate: timestamp("target_close_date", { withTimezone: true }),

    // Escape hatch for workflow fields not yet normalised
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("opportunities_org_id_idx").on(table.organisationId),
    index("opportunities_owner_user_id_idx").on(table.ownerUserId),
    index("opportunities_status_idx").on(table.status),
    index("opportunities_created_by_idx").on(table.createdByUserId),
  ],
);

// ── Contacts ──────────────────────────────────────────────────────────────────
// Contacts associated with opportunities.
// metadata JSONB preserves enrichment data and any LogicGate-specific fields.
export const contactsTable = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),
    opportunityId: uuid("opportunity_id").references(() => opportunitiesTable.id),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),

    name: text("name").notNull(),
    email: varchar("email", { length: 320 }),
    jobTitle: text("job_title"),
    company: text("company"),
    phone: varchar("phone", { length: 80 }),
    linkedin: text("linkedin"),
    notes: text("notes"),
    relationship: text("relationship"),
    influence: text("influence"),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("contacts_opportunity_id_idx").on(table.opportunityId),
    index("contacts_org_id_idx").on(table.organisationId),
    index("contacts_created_by_idx").on(table.createdByUserId),
  ],
);

// ── Opportunity events ────────────────────────────────────────────────────────
// Immutable log of AI-generated outputs and manual notes per opportunity.
// Replaces the in-memory `events` array on the Opportunity object.
export const opportunityEventsTable = pgTable(
  "opportunity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunitiesTable.id),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),

    type: text("type").notNull().default("note"),
    description: text("description").notNull().default(""),
    stage: text("stage"),
    outputSnapshot: jsonb("output_snapshot"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("opp_events_opportunity_id_idx").on(table.opportunityId),
  ],
);

// ── Opportunity working state ─────────────────────────────────────────────────
// Versioned JSONB blob for the full LogicGate working-session state.
// stateType = "logicgate_session" for the primary working state.
// Enforces one live row per (opportunityId, stateType) via unique constraint.
// Schema can evolve freely — bumping schemaVersion signals breaking changes.
export const opportunityWorkingStateTable = pgTable(
  "opportunity_working_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunitiesTable.id),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),

    stateType: text("state_type").notNull().default("logicgate_session"),
    schemaVersion: text("schema_version").notNull().default("1"),
    payload: jsonb("payload").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("opp_working_state_opp_type_uq").on(table.opportunityId, table.stateType),
    index("opp_working_state_opp_id_idx").on(table.opportunityId),
  ],
);

// ── Audit events ──────────────────────────────────────────────────────────────
// Append-only, cross-cutting event log. No updates or deletes.
// Covers opportunities, contacts, working state, and auth events.
export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id"),

    actorType: text("actor_type").notNull().default("user"),
    actorId: varchar("actor_id"),

    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),

    payload: jsonb("payload"),
    lens: text("lens"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_org_id_idx").on(table.organisationId),
    index("audit_events_actor_id_idx").on(table.actorId),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_event_type_idx").on(table.eventType),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

// ── Insert/select type exports ─────────────────────────────────────────────────
export type Organisation = typeof organisationsTable.$inferSelect;
export type InsertOrganisation = typeof organisationsTable.$inferInsert;

export type OrgMembership = typeof orgMembershipsTable.$inferSelect;
export type InsertOrgMembership = typeof orgMembershipsTable.$inferInsert;

export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type InsertOpportunity = typeof opportunitiesTable.$inferInsert;

export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = typeof contactsTable.$inferInsert;

export type OpportunityEvent = typeof opportunityEventsTable.$inferSelect;
export type InsertOpportunityEvent = typeof opportunityEventsTable.$inferInsert;

export type OpportunityWorkingState = typeof opportunityWorkingStateTable.$inferSelect;
export type InsertOpportunityWorkingState = typeof opportunityWorkingStateTable.$inferInsert;

export type AuditEvent = typeof auditEventsTable.$inferSelect;

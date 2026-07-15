/**
 * Retrieval Traces — provenance records for every assistant response.
 *
 * Purpose: make it possible to answer
 *   "Why did the assistant have access to this information?"
 * and
 *   "Why was a source excluded?"
 *
 * Design principles:
 *  - Store identifiers and classification metadata only — never raw content.
 *  - excluded_sources carries {sourceId, title, partition, sensitivity, reason}
 *    objects — no content from the excluded source.
 *  - policy_version ties each trace to the policy in force at retrieval time,
 *    so historical traces remain interpretable after policy updates.
 *  - The table is append-only for audit purposes.
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organisationsTable } from "./runtime";
import { conversationsTable, messagesTable } from "./conversations";

export interface ExcludedSourceRecord {
  sourceId: string;
  title: string;
  partition: string;
  sensitivity: string;
  reason: string;
}

export const retrievalTracesTable = pgTable(
  "retrieval_traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tenancy
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),

    // Context — what request this trace belongs to
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .references(() => messagesTable.id, { onDelete: "set null" }),

    // Lens and policy in force at time of retrieval
    activeLens: varchar("active_lens", { length: 32 }).notNull(),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),

    // What was used (identifiers only — never content)
    knowledgeAssetIds: text("knowledge_asset_ids").array().notNull().default([]),
    memorySourceTypes: text("memory_source_types").array().notNull().default([]),
    partitionsIncluded: text("partitions_included").array().notNull().default([]),
    sensitivityLevelsIncluded: text("sensitivity_levels_included").array().notNull().default([]),

    // What was excluded and why (no content — identifiers and reasons only)
    excludedSources: jsonb("excluded_sources")
      .$type<ExcludedSourceRecord[]>()
      .notNull()
      .default([]),

    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("retrieval_traces_conversation_id_idx").on(table.conversationId),
    index("retrieval_traces_message_id_idx").on(table.messageId),
    index("retrieval_traces_org_id_idx").on(table.organisationId),
    index("retrieval_traces_active_lens_idx").on(table.activeLens),
    index("retrieval_traces_retrieved_at_idx").on(table.retrievedAt),
  ],
);

export type RetrievalTrace = typeof retrievalTracesTable.$inferSelect;
export type InsertRetrievalTrace = typeof retrievalTracesTable.$inferInsert;

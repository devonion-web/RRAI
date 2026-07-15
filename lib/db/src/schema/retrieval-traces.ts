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
 *  - Extended columns (search metadata) are nullable — existing rows without
 *    retrieval search data remain valid.
 */

import {
  index,
  integer,
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

/** Score summary record stored in the trace — no content, identifiers and scores only. */
export interface ChunkScoreSummary {
  chunkId: string;
  assetId: string;
  score: number;
  evidenceTier: string;
  verificationState: string;
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

    // ── Search metadata (nullable — not present in pre-retrieval-engine traces) ─

    /** The search query sent to the retrieval engine. */
    searchQuery: text("search_query"),
    /** Retrieval engine version (e.g. "retrieval-v1"). */
    searchVersion: varchar("search_version", { length: 64 }),
    /** Chunking policy version in effect (e.g. "chunk-v1"). */
    chunkPolicyVersion: varchar("chunk_policy_version", { length: 64 }),
    /** Total candidates evaluated before budget filtering. */
    candidateCount: integer("candidate_count"),
    /** Ordered chunk IDs selected for the prompt (identifiers only). */
    selectedChunkIds: text("selected_chunk_ids").array(),
    /**
     * Score summaries for selected chunks.
     * Contains {chunkId, assetId, score, evidenceTier, verificationState} — no content.
     */
    scoreSummaries: jsonb("score_summaries").$type<ChunkScoreSummary[]>(),
    /** Evidence tiers represented in selected chunks. */
    evidenceTiersUsed: text("evidence_tiers_used").array(),
    /** Verification states represented in selected chunks. */
    verificationStatesUsed: text("verification_states_used").array(),
    /** Number of candidate chunks not included because they exceeded the context budget. */
    omittedDueToBudget: integer("omitted_due_to_budget"),
    /** Estimated total characters of knowledge content sent in this request. */
    contextCharEstimate: integer("context_char_estimate"),

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

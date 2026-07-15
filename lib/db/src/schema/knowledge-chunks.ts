/**
 * Knowledge Chunks — persistent retrieval index for governed knowledge assets.
 *
 * Design principles:
 *  - Chunk rows are DERIVED from governed knowledge files — not independent sources.
 *  - The knowledge manifest remains the authority for asset classification.
 *  - Where chunk metadata conflicts with the parent asset, the parent asset's
 *    more restrictive classification ALWAYS wins (enforced at indexing time).
 *  - Content hashes enable incremental re-indexing — unchanged chunks are not rebuilt.
 *  - This table is managed by the knowledge-indexing-service (append/upsert/delete only).
 *  - Never expose raw content through admin diagnostics — identifiers and classification only.
 *
 * Index version: index-v1
 */

import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const knowledgeChunksTable = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ── Source identity ─────────────────────────────────────────────────────
    /** Stable asset ID from the knowledge manifest. */
    assetId: text("asset_id").notNull(),
    /** Ordinal position of this chunk within the source asset. */
    chunkIndex: integer("chunk_index").notNull(),
    /** Full heading hierarchy path, e.g. "Platform Overview > Key Modules" */
    headingPath: text("heading_path").notNull().default(""),
    /** Retrievable text content of this chunk. */
    content: text("content").notNull(),
    /**
     * SHA-256 hex digest of (headingPath + content) — used for change detection.
     * Changing heading or content changes the hash and triggers a re-index.
     */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    /** Approximate token count (chars / 4). Used for context budget planning. */
    tokenEstimate: integer("token_estimate").notNull().default(0),

    // ── Classification — inherited from manifest; parent overrides chunk ───
    /** Partition classification — never weaker than the parent asset. */
    partition: varchar("partition", { length: 32 }).notNull(),
    /** Sensitivity level — never weaker than the parent asset. */
    sensitivity: varchar("sensitivity", { length: 32 }).notNull(),
    /** Verification state of the source asset at indexing time. */
    verificationState: varchar("verification_state", { length: 32 }).notNull().default("draft"),
    /**
     * Evidence tier — derived from verificationState + partition at indexing time.
     * Values: "governed" | "established" | "current" | "observed" | "unverified"
     * Higher tiers receive a ranking boost in hybrid search scoring.
     */
    evidenceTier: varchar("evidence_tier", { length: 32 }).notNull().default("observed"),

    // ── Retrieval metadata ───────────────────────────────────────────────────
    /** Tags extracted from the source asset (e.g. ["GRC", "TPRM", "LogicGate"]). */
    tags: text("tags").array().notNull().default([]),

    // ── Provenance ───────────────────────────────────────────────────────────
    /** When the source file was last modified (file mtime at indexing time). */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    /** When this chunk was last written to the index. */
    indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Index schema version — bump when chunking rules change to trigger full
     * reindex of all assets on next startup.
     */
    indexVersion: varchar("index_version", { length: 64 }).notNull(),
  },
  (table) => [
    // Efficient asset lookup
    index("knowledge_chunks_asset_id_idx").on(table.assetId),
    // Unique: one chunk record per (asset, chunkIndex) pair
    uniqueIndex("knowledge_chunks_asset_chunk_uidx").on(table.assetId, table.chunkIndex),
    // Partition and sensitivity filters applied at search time
    index("knowledge_chunks_partition_idx").on(table.partition),
    index("knowledge_chunks_sensitivity_idx").on(table.sensitivity),
    // Evidence tier used in hybrid scoring
    index("knowledge_chunks_evidence_idx").on(table.evidenceTier),
    // Content hash lookup for incremental indexing
    index("knowledge_chunks_hash_idx").on(table.contentHash),
    // Index version lookup for bulk version-triggered reindex
    index("knowledge_chunks_version_idx").on(table.indexVersion),
  ],
);

export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunksTable.$inferInsert;

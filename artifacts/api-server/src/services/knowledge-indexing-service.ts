/**
 * Knowledge Indexing Service — chunks and indexes governed knowledge assets.
 *
 * Pipeline:
 *  1. Read the knowledge manifest (TypeScript runtime registry).
 *  2. Validate each indexable asset (file exists, non-empty, classification intact).
 *  3. Load the source Markdown.
 *  4. Chunk it deterministically via knowledge-chunking-service.
 *  5. Upsert changed chunks (content hash change detection — unchanged chunks skipped).
 *  6. Remove stale chunks (asset was rechunked — old chunkIndex rows removed).
 *  7. Record index version and timestamps.
 *  8. Remove orphan chunks for assets no longer in the manifest.
 *
 * Indexing is idempotent — running multiple times is safe.
 *
 * This service does NOT run on every request.
 * Triggers:
 *  - Startup validation (validate only — no full reindex by default)
 *  - POST /api/admin/knowledge/index (explicit full reindex)
 *  - POST /api/admin/knowledge/index/:assetId (single asset reindex)
 *
 * Security:
 *  - Only assets in KNOWLEDGE_MANIFEST may be indexed.
 *  - Placeholder and restricted assets are never indexed.
 *  - suppliedToLlm:false assets are never indexed.
 *  - Chunk classification is always at least as restrictive as the parent asset.
 *
 * Index version: index-v1
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { eq, and, notInArray, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { knowledgeChunksTable } from "@workspace/db/schema";
import {
  KNOWLEDGE_MANIFEST,
  getActiveSuppliedAssets,
  type ManifestAsset,
} from "../lib/knowledge-manifest";
import {
  chunkMarkdown,
  deriveEvidenceTier,
  extractTags,
  CHUNK_POLICY_VERSION,
} from "./knowledge-chunking-service";
import { logger } from "../lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

const INDEX_VERSION = "index-v1";
const WORKSPACE_ROOT = join(process.cwd(), "..", "..");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssetIndexStatus {
  assetId: string;
  title: string;
  partition: string;
  sensitivity: string;
  indexable: boolean;
  indexed: boolean;
  chunkCount: number;
  lastIndexedAt: Date | null;
  indexVersion: string | null;
  validationError?: string;
}

export interface IndexStatus {
  indexVersion: string;
  chunkPolicyVersion: string;
  totalChunks: number;
  indexableAssets: number;
  indexedAssets: number;
  assets: AssetIndexStatus[];
  checkedAt: Date;
}

export interface ReindexResult {
  assetId: string;
  title: string;
  status: "indexed" | "skipped" | "failed" | "removed";
  chunksAdded: number;
  chunksUpdated: number;
  chunksRemoved: number;
  error?: string;
}

// ── Path resolution ───────────────────────────────────────────────────────────

function resolveAssetPath(asset: ManifestAsset): string {
  return join(WORKSPACE_ROOT, "knowledge", asset.file);
}

// ── Indexability check ────────────────────────────────────────────────────────

function isIndexable(asset: ManifestAsset): { ok: boolean; reason?: string } {
  if (asset.status !== "active") return { ok: false, reason: `status="${asset.status}"` };
  if (!asset.suppliedToLlm) return { ok: false, reason: "suppliedToLlm:false" };
  if (asset.partition === "restricted") return { ok: false, reason: "restricted partition" };

  const filePath = resolveAssetPath(asset);
  if (!existsSync(filePath)) return { ok: false, reason: `file not found: ${asset.file}` };

  return { ok: true };
}

// ── FTS index setup ───────────────────────────────────────────────────────────

/**
 * Create the full-text search GIN index on knowledge_chunks if not already present.
 * Runs at indexing startup — idempotent.
 */
async function ensureFtsIndex(): Promise<void> {
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_gin_idx
        ON knowledge_chunks
        USING GIN (to_tsvector('english', coalesce(heading_path, '') || ' ' || content))`,
  );
  logger.info("knowledge-indexing: FTS GIN index ensured");
}

// ── Single asset index ────────────────────────────────────────────────────────

/**
 * Index or re-index a single asset.
 *
 * Algorithm:
 *  1. Load and chunk the Markdown source.
 *  2. For each chunk, check if a row with the same (assetId, chunkIndex) exists.
 *     - If content hash matches → skip (no change).
 *     - If hash differs → update the row.
 *     - If row is new → insert.
 *  3. Remove any rows for this asset with chunkIndex > new max index
 *     (the asset was rechunked into fewer chunks).
 */
async function indexAsset(asset: ManifestAsset): Promise<ReindexResult> {
  const filePath = resolveAssetPath(asset);
  let markdown: string;
  let sourceMtime: Date;

  try {
    markdown = readFileSync(filePath, "utf-8");
    sourceMtime = statSync(filePath).mtime;
    if (!markdown.trim()) {
      return { assetId: asset.id, title: asset.title, status: "skipped", chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0, error: "empty file" };
    }
  } catch (err) {
    return {
      assetId: asset.id, title: asset.title, status: "failed",
      chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0,
      error: `failed to read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const chunks = chunkMarkdown(markdown);
  if (chunks.length === 0) {
    return { assetId: asset.id, title: asset.title, status: "skipped", chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0, error: "no chunks produced" };
  }

  // Derive classification from parent asset (parent always overrides chunk)
  const partition = asset.partition;
  const sensitivity = asset.sensitivity;
  const verificationState = asset.verificationState;
  const evidenceTier = deriveEvidenceTier(verificationState, partition);
  const tags = extractTags(asset.title, markdown);

  let chunksAdded = 0;
  let chunksUpdated = 0;

  for (const chunk of chunks) {
    const existingRows = await db
      .select({ id: knowledgeChunksTable.id, contentHash: knowledgeChunksTable.contentHash })
      .from(knowledgeChunksTable)
      .where(
        and(
          eq(knowledgeChunksTable.assetId, asset.id),
          eq(knowledgeChunksTable.chunkIndex, chunk.chunkIndex),
        ),
      )
      .limit(1);

    const existing = existingRows[0];

    if (existing) {
      if (existing.contentHash === chunk.contentHash) {
        // Content unchanged — skip
        continue;
      }
      // Content changed — update
      await db
        .update(knowledgeChunksTable)
        .set({
          headingPath: chunk.headingPath,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenEstimate: chunk.tokenEstimate,
          partition,
          sensitivity,
          verificationState,
          evidenceTier,
          tags,
          sourceUpdatedAt: sourceMtime,
          indexedAt: new Date(),
          indexVersion: INDEX_VERSION,
        })
        .where(eq(knowledgeChunksTable.id, existing.id));
      chunksUpdated++;
    } else {
      // New chunk — insert
      await db.insert(knowledgeChunksTable).values({
        assetId: asset.id,
        chunkIndex: chunk.chunkIndex,
        headingPath: chunk.headingPath,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenEstimate: chunk.tokenEstimate,
        partition,
        sensitivity,
        verificationState,
        evidenceTier,
        tags,
        sourceUpdatedAt: sourceMtime,
        indexedAt: new Date(),
        indexVersion: INDEX_VERSION,
      });
      chunksAdded++;
    }
  }

  // Remove stale chunks (asset was rechunked into fewer chunks)
  const validIndices = chunks.map((c) => c.chunkIndex);
  const deletedRows = await db
    .delete(knowledgeChunksTable)
    .where(
      and(
        eq(knowledgeChunksTable.assetId, asset.id),
        notInArray(knowledgeChunksTable.chunkIndex, validIndices),
      ),
    )
    .returning({ id: knowledgeChunksTable.id });

  const chunksRemoved = deletedRows.length;

  return {
    assetId: asset.id,
    title: asset.title,
    status: "indexed",
    chunksAdded,
    chunksUpdated,
    chunksRemoved,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate all registered assets without modifying the index.
 * Runs at server startup. Returns a status report.
 */
export async function validateManifest(): Promise<IndexStatus> {
  return getIndexStatus();
}

/**
 * Get current index status for all registered assets.
 * Safe to call at any time — read-only.
 */
export async function getIndexStatus(): Promise<IndexStatus> {
  const allAssets = KNOWLEDGE_MANIFEST;
  const assetStatuses: AssetIndexStatus[] = [];

  for (const asset of allAssets) {
    const check = isIndexable(asset);

    // Get chunk count from DB
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        lastIndexedAt: sql<Date | null>`max(${knowledgeChunksTable.indexedAt})`,
        indexVersion: sql<string | null>`max(${knowledgeChunksTable.indexVersion})`,
      })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.assetId, asset.id));

    const row = rows[0];

    assetStatuses.push({
      assetId: asset.id,
      title: asset.title,
      partition: asset.partition,
      sensitivity: asset.sensitivity,
      indexable: check.ok,
      indexed: (row?.count ?? 0) > 0,
      chunkCount: row?.count ?? 0,
      lastIndexedAt: row?.lastIndexedAt ?? null,
      indexVersion: row?.indexVersion ?? null,
      ...(check.ok ? {} : { validationError: check.reason }),
    });
  }

  const totalChunks = assetStatuses.reduce((s, a) => s + a.chunkCount, 0);
  const indexableCount = assetStatuses.filter((a) => a.indexable).length;
  const indexedCount = assetStatuses.filter((a) => a.indexed).length;

  return {
    indexVersion: INDEX_VERSION,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    totalChunks,
    indexableAssets: indexableCount,
    indexedAssets: indexedCount,
    assets: assetStatuses,
    checkedAt: new Date(),
  };
}

/**
 * Reindex all indexable assets.
 *
 * - Assets that have not changed (hash match) are skipped.
 * - Assets no longer in the manifest have their chunks removed.
 * - Placeholder and restricted assets are skipped.
 */
export async function reindexAll(): Promise<{
  results: ReindexResult[];
  durationMs: number;
}> {
  const start = Date.now();
  logger.info({ indexVersion: INDEX_VERSION }, "knowledge-indexing: starting full reindex");

  await ensureFtsIndex();

  const indexableAssets = getActiveSuppliedAssets();
  const results: ReindexResult[] = [];

  for (const asset of indexableAssets) {
    const check = isIndexable(asset);
    if (!check.ok) {
      results.push({
        assetId: asset.id, title: asset.title, status: "skipped",
        chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0,
        error: check.reason,
      });
      continue;
    }

    try {
      const result = await indexAsset(asset);
      results.push(result);
      logger.info(result, `knowledge-indexing: indexed ${asset.title}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ err, assetId: asset.id }, "knowledge-indexing: failed to index asset");
      results.push({
        assetId: asset.id, title: asset.title, status: "failed",
        chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0, error,
      });
    }
  }

  // Remove orphan chunks for assets no longer in the manifest or no longer indexable
  const validAssetIds = indexableAssets.map((a) => a.id);
  if (validAssetIds.length > 0) {
    const orphanResult = await db
      .delete(knowledgeChunksTable)
      .where(notInArray(knowledgeChunksTable.assetId, validAssetIds))
      .returning({ id: knowledgeChunksTable.id, assetId: knowledgeChunksTable.assetId });

    if (orphanResult.length > 0) {
      logger.info({ count: orphanResult.length }, "knowledge-indexing: removed orphan chunks");
    }
  }

  const durationMs = Date.now() - start;
  logger.info({ durationMs, results }, "knowledge-indexing: full reindex complete");

  return { results, durationMs };
}

/**
 * Reindex a single asset by ID.
 * Returns null if the asset is not found in the manifest.
 */
export async function reindexAsset(assetId: string): Promise<ReindexResult | null> {
  const asset = KNOWLEDGE_MANIFEST.find((a) => a.id === assetId);
  if (!asset) return null;

  await ensureFtsIndex();

  const check = isIndexable(asset);
  if (!check.ok) {
    return {
      assetId: asset.id, title: asset.title, status: "skipped",
      chunksAdded: 0, chunksUpdated: 0, chunksRemoved: 0,
      error: check.reason,
    };
  }

  return indexAsset(asset);
}

/**
 * Get the chunk count for a set of asset IDs.
 * Used by the search service to verify the index is populated.
 */
export async function getChunkCountForAssets(assetIds: string[]): Promise<number> {
  if (assetIds.length === 0) return 0;

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeChunksTable)
    .where(inArray(knowledgeChunksTable.assetId, assetIds));

  return rows[0]?.count ?? 0;
}

/**
 * Startup validation — run at server start.
 * Logs a warning if any active asset file is missing.
 * Does NOT trigger a full reindex.
 */
export async function runStartupValidation(): Promise<void> {
  logger.info("knowledge-indexing: running startup validation");

  const activeAssets = getActiveSuppliedAssets();
  let missingFiles = 0;

  for (const asset of activeAssets) {
    const check = isIndexable(asset);
    if (!check.ok) {
      logger.warn({ assetId: asset.id, reason: check.reason }, "knowledge-indexing: asset not indexable at startup");
      missingFiles++;
    }
  }

  if (missingFiles === 0) {
    logger.info({ activeAssets: activeAssets.length }, "knowledge-indexing: all active assets validated");
  }

  // Auto-index if no chunks exist yet (first run after schema migration)
  const allChunks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeChunksTable);

  const totalChunks = allChunks[0]?.count ?? 0;

  if (totalChunks === 0 && activeAssets.length > 0) {
    logger.info("knowledge-indexing: no chunks found — running initial full index");
    await reindexAll();
  } else {
    logger.info({ totalChunks }, "knowledge-indexing: index populated");
  }
}

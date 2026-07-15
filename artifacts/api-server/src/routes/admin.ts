/**
 * Admin knowledge routes — index management and retrieval diagnostics.
 *
 * All routes require authentication AND admin role.
 * Diagnostics return safe metadata only — never raw confidential content.
 *
 * Routes:
 *   GET  /admin/knowledge/index/status      — current index status + manifest validation
 *   POST /admin/knowledge/index             — reindex all assets
 *   POST /admin/knowledge/index/:assetId    — reindex one asset
 *   GET  /admin/knowledge/search            — diagnostic search (safe snippets + policy details)
 *   GET  /admin/knowledge/manifest          — manifest registry (classification metadata)
 *   GET  /admin/knowledge/corpus            — corpus inventory: asset/chunk counts by classification
 *   GET  /admin/knowledge/policy            — retrieval policy: thresholds + vocabulary summary
 */

import { Router, type Request, type Response } from "express";
import {
  requireAuthenticatedUser,
  requireRole,
  getAuthenticatedUser,
} from "../middlewares/routeAuth";
import * as opportunitiesService from "../services/opportunities-service";
import {
  getIndexStatus,
  reindexAll,
  reindexAsset,
} from "../services/knowledge-indexing-service";
import {
  searchKnowledge,
  toSafeDiagnostic,
  SEARCH_VERSION,
} from "../services/knowledge-search-service";
import { CHUNK_POLICY_VERSION } from "../services/knowledge-chunking-service";
import { computeRoutingDecision } from "../services/lens-routing-service";
import {
  KNOWLEDGE_MANIFEST,
  validateManifest,
} from "../lib/knowledge-manifest";
import {
  RETRIEVAL_POLICY_VERSION,
  RETRIEVAL_THRESHOLDS,
  DOMAIN_VOCABULARY,
} from "../config/retrieval-policy";
import { db } from "@workspace/db";
import { knowledgeChunksTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { Lens } from "../policies/lens-policy";

const router = Router();

// All /admin/* routes require an authenticated admin session
router.use("/admin{/*splat}", requireAuthenticatedUser, requireRole("admin"));

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function resolveActor(req: Request, res: Response): Promise<{ userId: string; orgId: string } | null> {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorised" });
    return null;
  }
  const orgId = await opportunitiesService.resolveUserOrg(user.id);
  if (!orgId) {
    res.status(403).json({ error: "No organisation membership — contact your administrator" });
    return null;
  }
  return { userId: user.id, orgId };
}

function handleServiceError(res: Response, err: unknown): void {
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    if (status === 400) { res.status(400).json({ error: err.message }); return; }
    if (status === 403) { res.status(403).json({ error: err.message }); return; }
    if (status === 404) { res.status(404).json({ error: err.message }); return; }
  }
  logger.error({ err }, "admin route: unexpected error");
  res.status(500).json({ error: "Internal server error" });
}

// ─── GET /admin/knowledge/index/status ─────────────────────────────────────
//
// Returns the current index status for all registered assets.
// Includes manifest validation results.

router.get("/admin/knowledge/index/status", async (_req: Request, res: Response) => {
  try {
    const status = await getIndexStatus();
    const validation = validateManifest();
    res.json({
      ...status,
      manifestValidation: {
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── POST /admin/knowledge/index ───────────────────────────────────────────
//
// Trigger a full reindex of all indexable assets.
// Skips unchanged assets (content hash match).

router.post("/admin/knowledge/index", async (_req: Request, res: Response) => {
  try {
    const { results, durationMs } = await reindexAll();
    res.json({
      message: "Reindex complete",
      durationMs,
      results,
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── POST /admin/knowledge/index/:assetId ──────────────────────────────────
//
// Reindex a single asset by ID.

router.post("/admin/knowledge/index/:assetId", async (req: Request, res: Response) => {
  const raw = req.params["assetId"];
  const assetId = String(Array.isArray(raw) ? raw[0] : raw ?? "");

  if (!assetId) {
    res.status(400).json({ error: "assetId is required" });
    return;
  }

  try {
    const result = await reindexAsset(assetId);
    if (!result) {
      res.status(404).json({ error: `Asset "${assetId}" not found in manifest` });
      return;
    }
    res.json({ message: "Asset reindex complete", result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /admin/knowledge/search ─────────────────────────────────────────────
//
// Diagnostic search — returns scored results with safe snippets.
// Content is redacted for confidential/restricted chunks.
// Includes: policy version, threshold decisions, vocabulary expansions, no-result reason.
//
// Query params:
//   q     — search query (required)
//   lens  — active lens (default: "analyst")
//   limit — max results (default: 10, max: 20)

router.get("/admin/knowledge/search", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  const query = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const lensParam = typeof req.query["lens"] === "string" ? req.query["lens"] : "analyst";
  const lens = (["analyst", "intelligence", "commercial", "delivery"].includes(lensParam)
    ? lensParam
    : "analyst") as Lens;

  const limitParam = Number(req.query["limit"] ?? "10");
  const limit = Math.min(20, Math.max(1, isNaN(limitParam) ? 10 : limitParam));

  try {
    const routingDecision = computeRoutingDecision({ activeLens: lens });
    const permittedAssets = routingDecision.permittedKnowledgeAssets.filter((a) => a.suppliedToLlm);

    const searchOutput = await searchKnowledge({
      userQuery: query,
      permittedAssetIds: permittedAssets.map((a) => a.id),
      permittedPartitions: routingDecision.policy.permittedKnowledgePartitions as string[],
      sensitivityCeiling: routingDecision.sensitivityCeiling,
      permittedAssets,
      maxResults: limit,
      activeLens: lens,
    });

    // Build threshold decision log
    const thresholdDecisions = {
      minFtsScore: RETRIEVAL_THRESHOLDS.MIN_FTS_SCORE,
      minFinalScore: RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE,
      maxChunksPerAsset: RETRIEVAL_THRESHOLDS.MAX_CHUNKS_PER_ASSET,
      maxAssetFraction: RETRIEVAL_THRESHOLDS.MAX_ASSET_FRACTION,
      resultsExcludedBelowThreshold: searchOutput.resultsExcludedBelowThreshold,
      duplicatesRemoved: searchOutput.duplicatesRemoved,
    };

    const noResultReason = searchOutput.noResult
      ? searchOutput.candidateCount === 0
        ? "No FTS or tag-fallback candidates found for this query"
        : `${searchOutput.candidateCount} candidate(s) found but all excluded below threshold (MIN_FINAL_SCORE=${RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE})`
      : null;

    res.json({
      query: searchOutput.query,
      normalisedQuery: searchOutput.normalisedQuery,
      enrichedQuery: searchOutput.enrichedQuery,
      vocabExpansions: searchOutput.vocabExpansions,
      lens,
      retrievalPolicyVersion: searchOutput.retrievalPolicyVersion,
      searchVersion: SEARCH_VERSION,
      chunkPolicyVersion: CHUNK_POLICY_VERSION,
      candidateCount: searchOutput.candidateCount,
      selectedCount: searchOutput.results.length,
      omittedDueToBudget: searchOutput.omittedDueToBudget,
      noResult: searchOutput.noResult,
      noResultReason,
      conflictDetected: searchOutput.conflictDetected,
      conflictDescription: searchOutput.conflictDescription,
      thresholdDecisions,
      excluded: searchOutput.excluded,
      results: searchOutput.results.map(toSafeDiagnostic),
      searchLatencyMs: searchOutput.searchLatencyMs,
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /admin/knowledge/manifest ───────────────────────────────────────────
//
// Returns the manifest registry (classification metadata — no content).

router.get("/admin/knowledge/manifest", async (_req: Request, res: Response) => {
  const validation = validateManifest();
  const assets = KNOWLEDGE_MANIFEST.map((a) => ({
    id: a.id,
    title: a.title,
    path: a.path,
    partition: a.partition,
    sensitivity: a.sensitivity,
    verificationState: a.verificationState,
    status: a.status,
    suppliedToLlm: a.suppliedToLlm,
    owner: a.owner,
    lastReviewedDate: a.lastReviewedDate,
  }));
  res.json({
    assets,
    total: assets.length,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  });
});

// ─── GET /admin/knowledge/corpus ─────────────────────────────────────────────
//
// Returns corpus inventory: total chunk counts broken down by asset,
// partition, sensitivity, and evidence tier.
// Includes last-index timestamps where available.

router.get("/admin/knowledge/corpus", async (_req: Request, res: Response) => {
  try {
    // Chunk counts by asset
    const byAsset = await db.execute(sql`
      SELECT
        asset_id          AS "assetId",
        COUNT(*)::int     AS "chunkCount",
        MAX(indexed_at)   AS "lastIndexedAt"
      FROM knowledge_chunks
      GROUP BY asset_id
      ORDER BY "chunkCount" DESC
    `) as unknown as Array<{ assetId: string; chunkCount: number; lastIndexedAt: string }>;

    // Chunk counts by partition
    const byPartition = await db.execute(sql`
      SELECT
        partition,
        COUNT(*)::int AS "chunkCount"
      FROM knowledge_chunks
      GROUP BY partition
      ORDER BY "chunkCount" DESC
    `) as unknown as Array<{ partition: string; chunkCount: number }>;

    // Chunk counts by sensitivity
    const bySensitivity = await db.execute(sql`
      SELECT
        sensitivity,
        COUNT(*)::int AS "chunkCount"
      FROM knowledge_chunks
      GROUP BY sensitivity
      ORDER BY "chunkCount" DESC
    `) as unknown as Array<{ sensitivity: string; chunkCount: number }>;

    // Chunk counts by evidence tier
    const byEvidenceTier = await db.execute(sql`
      SELECT
        evidence_tier     AS "evidenceTier",
        COUNT(*)::int     AS "chunkCount"
      FROM knowledge_chunks
      GROUP BY evidence_tier
      ORDER BY "chunkCount" DESC
    `) as unknown as Array<{ evidenceTier: string; chunkCount: number }>;

    // Total
    const [{ total }] = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM knowledge_chunks
    `) as unknown as Array<{ total: number }>;

    // Manifest summary
    const activeAssets = KNOWLEDGE_MANIFEST.filter((a) => a.status === "active");
    const llmEligible = activeAssets.filter((a) => a.suppliedToLlm && a.partition !== "restricted");

    res.json({
      totalChunks: total ?? 0,
      registeredAssets: KNOWLEDGE_MANIFEST.length,
      activeAssets: activeAssets.length,
      llmEligibleAssets: llmEligible.length,
      byAsset: byAsset.map((row) => {
        const asset = KNOWLEDGE_MANIFEST.find((a) => a.id === row.assetId);
        return {
          assetId: row.assetId,
          title: asset?.title ?? row.assetId,
          partition: asset?.partition ?? "unknown",
          sensitivity: asset?.sensitivity ?? "unknown",
          chunkCount: row.chunkCount,
          lastIndexedAt: row.lastIndexedAt,
        };
      }),
      byPartition,
      bySensitivity,
      byEvidenceTier,
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /admin/knowledge/policy ─────────────────────────────────────────────
//
// Returns the current retrieval policy: version, thresholds, vocabulary summary.

router.get("/admin/knowledge/policy", async (_req: Request, res: Response) => {
  res.json({
    retrievalPolicyVersion: RETRIEVAL_POLICY_VERSION,
    searchVersion: SEARCH_VERSION,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    thresholds: {
      minFtsScore: RETRIEVAL_THRESHOLDS.MIN_FTS_SCORE,
      minFinalScore: RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE,
      maxCandidates: RETRIEVAL_THRESHOLDS.MAX_CANDIDATES,
      maxResults: RETRIEVAL_THRESHOLDS.MAX_RESULTS,
      maxChunksPerAsset: RETRIEVAL_THRESHOLDS.MAX_CHUNKS_PER_ASSET,
      maxContextChars: RETRIEVAL_THRESHOLDS.MAX_CONTEXT_CHARS,
      maxAssetFraction: RETRIEVAL_THRESHOLDS.MAX_ASSET_FRACTION,
      nearDuplicateHeadingMatch: RETRIEVAL_THRESHOLDS.NEAR_DUPLICATE_HEADING_MATCH,
      duplicateHeadingPenalty: RETRIEVAL_THRESHOLDS.DUPLICATE_HEADING_PENALTY,
    },
    vocabulary: {
      entryCount: DOMAIN_VOCABULARY.length,
      entries: DOMAIN_VOCABULARY.map((e) => ({
        label: e.label,
        expansion: e.expansion,
      })),
    },
  });
});

export default router;

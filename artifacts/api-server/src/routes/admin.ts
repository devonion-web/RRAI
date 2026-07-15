/**
 * Admin knowledge routes — index management and retrieval diagnostics.
 *
 * All routes require authentication AND admin role.
 * Diagnostics return safe metadata only — never raw confidential content.
 *
 * Routes:
 *   GET  /admin/knowledge/index/status      — current index status
 *   POST /admin/knowledge/index             — reindex all assets
 *   POST /admin/knowledge/index/:assetId    — reindex one asset
 *   GET  /admin/knowledge/search            — diagnostic search (safe snippets)
 *   GET  /admin/knowledge/manifest          — manifest registry (classification metadata)
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
import { KNOWLEDGE_MANIFEST } from "../lib/knowledge-manifest";
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
// Safe to call frequently — read-only.

router.get("/admin/knowledge/index/status", async (_req: Request, res: Response) => {
  try {
    const status = await getIndexStatus();
    res.json(status);
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

    res.json({
      query: searchOutput.query,
      enrichedQuery: searchOutput.enrichedQuery,
      lens,
      searchVersion: SEARCH_VERSION,
      chunkPolicyVersion: CHUNK_POLICY_VERSION,
      candidateCount: searchOutput.candidateCount,
      selectedCount: searchOutput.results.length,
      omittedDueToBudget: searchOutput.omittedDueToBudget,
      excluded: searchOutput.excluded,
      results: searchOutput.results.map(toSafeDiagnostic),
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /admin/knowledge/manifest ───────────────────────────────────────────
//
// Returns the manifest registry (classification metadata — no content).

router.get("/admin/knowledge/manifest", async (_req: Request, res: Response) => {
  const assets = KNOWLEDGE_MANIFEST.map((a) => ({
    id: a.id,
    title: a.title,
    partition: a.partition,
    sensitivity: a.sensitivity,
    verificationState: a.verificationState,
    status: a.status,
    suppliedToLlm: a.suppliedToLlm,
    owner: a.owner,
  }));
  res.json({ assets, total: assets.length });
});

export default router;

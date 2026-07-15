/**
 * Knowledge Search Service — hybrid lexical + metadata ranking for governed chunks.
 *
 * Search operates INSIDE the retrieval membrane — only permitted chunks are searched.
 * The routing decision is applied BEFORE search, not after.
 *
 * Search pipeline:
 *  1. Build query from user request (+ optional context enrichment)
 *  2. Restrict to permitted asset IDs and partitions (from routing decision)
 *  3. Apply sensitivity ceiling filter
 *  4. PostgreSQL full-text search (tsvector + tsquery)
 *  5. Hybrid scoring:
 *       - FTS rank (ts_rank)
 *       - Heading/title match boost
 *       - Tag match boost
 *       - Evidence tier weight
 *       - Verification state weight
 *       - Duplicate penalty (identical headingPath within results)
 *  6. Apply context budget (chars) and max result count
 *  7. Return scored results with provenance metadata
 *
 * The service is deterministic and testable without calling an LLM.
 *
 * Search version: retrieval-v1
 * Chunk policy version: chunk-v1
 *
 * Vector search: pgvector extension is installed but not used in v1 (no embedding
 * provider configured). Column exists for future hybrid search enhancement.
 */

import { inArray, and, or, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { knowledgeChunksTable } from "@workspace/db/schema";
import type { ManifestAsset } from "../lib/knowledge-manifest";
import { CHUNK_POLICY_VERSION } from "./knowledge-chunking-service";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SEARCH_VERSION = "retrieval-v1";

/** Maximum number of chunks to return before budget filtering. */
const MAX_CANDIDATES = 20;
/** Maximum number of chunks to include in context after budget filtering. */
const DEFAULT_MAX_RESULTS = 10;
/** Minimum FTS score to include a result (filters out near-zero matches). */
const MIN_FTS_SCORE = 0.0001;
/** Characters per approximate token. */
const CHARS_PER_TOKEN = 4;

// ── Sensitivity level ordering ────────────────────────────────────────────────

const SENSITIVITY_ORDER: Record<string, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

function sensitivityAllowed(chunkLevel: string, ceiling: string): boolean {
  const chunkOrd = SENSITIVITY_ORDER[chunkLevel] ?? 99;
  const ceilingOrd = SENSITIVITY_ORDER[ceiling] ?? 1;
  return chunkOrd <= ceilingOrd;
}

// ── Evidence tier scoring ─────────────────────────────────────────────────────

const EVIDENCE_TIER_WEIGHT: Record<string, number> = {
  governed: 0.25,
  established: 0.20,
  current: 0.10,
  observed: 0.05,
  unverified: 0.0,
};

const VERIFICATION_STATE_WEIGHT: Record<string, number> = {
  approved: 0.15,
  draft: 0.05,
  superseded: -0.10,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchInput {
  /** The user's current message — primary search query. */
  userQuery: string;
  /** Permitted asset IDs from the routing decision. */
  permittedAssetIds: string[];
  /** Permitted partitions from the routing decision. */
  permittedPartitions: string[];
  /** Sensitivity ceiling from the routing decision. */
  sensitivityCeiling: string;
  /** Asset manifest records keyed by ID — for title/tag enrichment. */
  permittedAssets: ManifestAsset[];
  /** Max chunks to return (default 10). */
  maxResults?: number;
  /** Character budget for knowledge content (default 25000). */
  charBudget?: number;
  /** Optional conversation type for context enrichment. */
  conversationType?: string | null;
  /** Optional lens name for context enrichment. */
  activeLens?: string;
}

export interface SearchScoreBreakdown {
  ftsRank: number;
  headingBoost: number;
  tagBoost: number;
  evidenceTierWeight: number;
  verificationWeight: number;
  duplicatePenalty: number;
  total: number;
}

export interface SearchResult {
  chunkId: string;
  assetId: string;
  chunkIndex: number;
  /** Asset title from the manifest. */
  title: string;
  headingPath: string;
  content: string;
  tokenEstimate: number;
  score: number;
  scoreBreakdown: SearchScoreBreakdown;
  partition: string;
  sensitivity: string;
  verificationState: string;
  evidenceTier: string;
  tags: string[];
}

export interface SearchOutput {
  query: string;
  enrichedQuery: string;
  results: SearchResult[];
  excluded: Array<{ assetId: string; reason: string }>;
  searchVersion: string;
  chunkPolicyVersion: string;
  candidateCount: number;
  omittedDueToBudget: number;
  totalCharsSelected: number;
}

// ── Query enrichment ──────────────────────────────────────────────────────────

/**
 * Deterministically enrich the search query with context signals.
 * No LLM — only keyword extraction and normalisation.
 *
 * Enrichment signals (v1):
 *  - Normalise GRC acronyms to their expanded form (improves recall)
 *  - No contamination of Analyst queries with excluded commercial context
 */
function enrichQuery(userQuery: string, lens?: string, conversationType?: string | null): string {
  let enriched = userQuery.trim();

  // Acronym expansion for known domain terms — improves recall
  const acronymExpansions: Array<[RegExp, string]> = [
    [/\bGRC\b/g, "GRC governance risk compliance"],
    [/\bTPRM\b/g, "TPRM third party risk management vendor risk"],
    [/\bRFP\b/g, "RFP request for proposal"],
    [/\bRFI\b/g, "RFI request for information"],
    [/\bSoW\b/gi, "SoW statement of work"],
    [/\bIAM\b/g, "IAM identity access management"],
    [/\bSOC\s*2\b/gi, "SOC2 compliance certification"],
    [/\bISO\s*27001\b/gi, "ISO27001 information security management"],
    [/\bDORA\b/g, "DORA digital operational resilience act"],
    [/\bNIS2\b/g, "NIS2 network information systems directive"],
    [/\bBCP\b/g, "BCP business continuity planning"],
    [/\bBCM\b/g, "BCM business continuity management"],
  ];

  for (const [pattern, expansion] of acronymExpansions) {
    if (pattern.test(enriched)) {
      pattern.lastIndex = 0; // reset stateful regex
      enriched = enriched + " " + expansion;
    }
  }

  return enriched.trim();
}

// ── Heading match boost ───────────────────────────────────────────────────────

/**
 * Boost a chunk if the search query terms appear in its heading path.
 * Heading matches indicate high topic relevance.
 */
function computeHeadingBoost(headingPath: string, queryTerms: string[]): number {
  const lower = headingPath.toLowerCase();
  let matches = 0;
  for (const term of queryTerms) {
    if (term.length >= 3 && lower.includes(term.toLowerCase())) matches++;
  }
  return Math.min(0.3, matches * 0.1);
}

// ── Tag boost ─────────────────────────────────────────────────────────────────

function computeTagBoost(chunkTags: string[], queryTerms: string[]): number {
  const queryLower = queryTerms.map((t) => t.toLowerCase());
  let matches = 0;
  for (const tag of chunkTags) {
    if (queryLower.some((q) => tag.toLowerCase().includes(q) || q.includes(tag.toLowerCase()))) {
      matches++;
    }
  }
  return Math.min(0.2, matches * 0.08);
}

// ── Main search function ──────────────────────────────────────────────────────

/**
 * Search the governed chunk index for content relevant to the user query.
 *
 * Security invariant: only chunks belonging to permittedAssetIds and
 * permittedPartitions are ever evaluated. Routing occurs before search.
 */
export async function searchKnowledge(input: SearchInput): Promise<SearchOutput> {
  const {
    userQuery,
    permittedAssetIds,
    permittedPartitions,
    sensitivityCeiling,
    permittedAssets,
    maxResults = DEFAULT_MAX_RESULTS,
    charBudget = 25_000,
    conversationType,
    activeLens,
  } = input;

  const excluded: Array<{ assetId: string; reason: string }> = [];

  // ── Guard: empty corpus ────────────────────────────────────────────────────

  if (permittedAssetIds.length === 0) {
    return {
      query: userQuery,
      enrichedQuery: userQuery,
      results: [],
      excluded,
      searchVersion: SEARCH_VERSION,
      chunkPolicyVersion: CHUNK_POLICY_VERSION,
      candidateCount: 0,
      omittedDueToBudget: 0,
      totalCharsSelected: 0,
    };
  }

  // ── Query enrichment ───────────────────────────────────────────────────────

  const enrichedQuery = enrichQuery(userQuery, activeLens, conversationType);

  // Build query terms for heading/tag boosting
  const queryTerms = enrichedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 20);

  // ── Build asset title map ──────────────────────────────────────────────────

  const assetTitleMap: Record<string, string> = {};
  for (const a of permittedAssets) {
    assetTitleMap[a.id] = a.title;
  }

  // ── FTS query construction ─────────────────────────────────────────────────
  // Use plainto_tsquery which handles natural language, multi-word, and
  // stopword removal. We also try websearch_to_tsquery for better phrase support.
  // If the query produces no FTS results, fall back to a LIKE-based retrieval
  // of the top chunks by evidence tier.

  // Build the tsquery — plainto_tsquery handles multi-word gracefully
  const tsQuery = enrichedQuery.replace(/'/g, "''"); // sanitise single quotes

  // ── Execute FTS search ─────────────────────────────────────────────────────

  let rows: Array<{
    id: string;
    assetId: string;
    chunkIndex: number;
    headingPath: string;
    content: string;
    tokenEstimate: number;
    partition: string;
    sensitivity: string;
    verificationState: string;
    evidenceTier: string;
    tags: string[];
    ftsRank: number;
  }> = [];

  try {
    rows = await db.execute(sql`
      SELECT
        id,
        asset_id                AS "assetId",
        chunk_index             AS "chunkIndex",
        heading_path            AS "headingPath",
        content,
        token_estimate          AS "tokenEstimate",
        partition,
        sensitivity,
        verification_state      AS "verificationState",
        evidence_tier           AS "evidenceTier",
        tags,
        ts_rank(
          to_tsvector('english', coalesce(heading_path, '') || ' ' || content),
          plainto_tsquery('english', ${tsQuery}),
          32
        ) AS "ftsRank"
      FROM knowledge_chunks
      WHERE
        asset_id = ANY(${permittedAssetIds})
        AND partition = ANY(${permittedPartitions})
        AND to_tsvector('english', coalesce(heading_path, '') || ' ' || content)
            @@ plainto_tsquery('english', ${tsQuery})
      ORDER BY "ftsRank" DESC
      LIMIT ${MAX_CANDIDATES}
    `) as unknown as typeof rows;
  } catch {
    // FTS index might not be ready — fall through to fallback
  }

  // ── Fallback: if FTS returns nothing, include top chunks by evidence tier ──

  let usedFallback = false;
  if (rows.length === 0) {
    usedFallback = true;
    const fallbackRows = await db
      .select({
        id: knowledgeChunksTable.id,
        assetId: knowledgeChunksTable.assetId,
        chunkIndex: knowledgeChunksTable.chunkIndex,
        headingPath: knowledgeChunksTable.headingPath,
        content: knowledgeChunksTable.content,
        tokenEstimate: knowledgeChunksTable.tokenEstimate,
        partition: knowledgeChunksTable.partition,
        sensitivity: knowledgeChunksTable.sensitivity,
        verificationState: knowledgeChunksTable.verificationState,
        evidenceTier: knowledgeChunksTable.evidenceTier,
        tags: knowledgeChunksTable.tags,
      })
      .from(knowledgeChunksTable)
      .where(
        and(
          inArray(knowledgeChunksTable.assetId, permittedAssetIds),
          inArray(knowledgeChunksTable.partition, permittedPartitions),
        ),
      )
      .limit(maxResults);

    rows = fallbackRows.map((r) => ({ ...r, ftsRank: 0 }));
  }

  const candidateCount = rows.length;

  // ── Apply sensitivity ceiling ──────────────────────────────────────────────

  const sensitivityFiltered = rows.filter((r) => {
    if (!sensitivityAllowed(r.sensitivity, sensitivityCeiling)) {
      excluded.push({
        assetId: r.assetId,
        reason: `sensitivity "${r.sensitivity}" exceeds ceiling "${sensitivityCeiling}"`,
      });
      return false;
    }
    return true;
  });

  // ── Hybrid scoring ────────────────────────────────────────────────────────

  const seenHeadingPaths = new Set<string>();

  const scored: SearchResult[] = sensitivityFiltered.map((r) => {
    const title = assetTitleMap[r.assetId] ?? r.assetId;
    const ftsRank = r.ftsRank;

    const headingBoost = computeHeadingBoost(r.headingPath, queryTerms);
    const tagBoost = computeTagBoost(r.tags, queryTerms);
    const evidenceTierWeight = EVIDENCE_TIER_WEIGHT[r.evidenceTier] ?? 0;
    const verificationWeight = VERIFICATION_STATE_WEIGHT[r.verificationState] ?? 0;

    // Duplicate penalty: same headingPath already seen in results
    const duplicatePenalty = seenHeadingPaths.has(r.headingPath) ? -0.15 : 0;
    seenHeadingPaths.add(r.headingPath);

    // Filter below minimum FTS threshold (but allow fallback results)
    const total = ftsRank + headingBoost + tagBoost + evidenceTierWeight + verificationWeight + duplicatePenalty;

    return {
      chunkId: r.id,
      assetId: r.assetId,
      chunkIndex: r.chunkIndex,
      title,
      headingPath: r.headingPath,
      content: r.content,
      tokenEstimate: r.tokenEstimate,
      score: Math.max(0, total),
      scoreBreakdown: {
        ftsRank,
        headingBoost,
        tagBoost,
        evidenceTierWeight,
        verificationWeight,
        duplicatePenalty,
        total,
      },
      partition: r.partition,
      sensitivity: r.sensitivity,
      verificationState: r.verificationState,
      evidenceTier: r.evidenceTier,
      tags: r.tags,
    };
  });

  // Sort by score descending (FTS already ordered, but hybrid scoring may reorder)
  scored.sort((a, b) => b.score - a.score);

  // Remove very weak results (only when FTS was used — not fallback)
  const filtered = usedFallback
    ? scored
    : scored.filter((r) => r.score > 0 || r.scoreBreakdown.ftsRank > MIN_FTS_SCORE);

  // ── Context budget enforcement ────────────────────────────────────────────

  const selected: SearchResult[] = [];
  let totalChars = 0;
  let omitted = 0;

  for (const result of filtered) {
    if (selected.length >= maxResults) {
      omitted++;
      continue;
    }
    if (totalChars + result.content.length > charBudget) {
      omitted++;
      continue;
    }
    selected.push(result);
    totalChars += result.content.length;
  }

  return {
    query: userQuery,
    enrichedQuery,
    results: selected,
    excluded,
    searchVersion: SEARCH_VERSION,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    candidateCount,
    omittedDueToBudget: omitted,
    totalCharsSelected: totalChars,
  };
}

// ── Safe admin diagnostic helper ──────────────────────────────────────────────

/**
 * Returns a diagnostic view of a search result — no raw content for confidential chunks.
 * Used by admin diagnostic endpoints only.
 */
export function toSafeDiagnostic(result: SearchResult) {
  const showContent =
    result.sensitivity === "public" || result.sensitivity === "internal";

  return {
    chunkId: result.chunkId,
    assetId: result.assetId,
    title: result.title,
    headingPath: result.headingPath,
    partition: result.partition,
    sensitivity: result.sensitivity,
    verificationState: result.verificationState,
    evidenceTier: result.evidenceTier,
    score: result.score,
    scoreBreakdown: result.scoreBreakdown,
    tokenEstimate: result.tokenEstimate,
    contentSnippet: showContent ? result.content.slice(0, 200) + "…" : "[content redacted]",
  };
}

/**
 * Knowledge Search Service — hybrid lexical + metadata ranking for governed chunks.
 *
 * Search operates INSIDE the retrieval membrane — only permitted chunks are searched.
 * The routing decision is applied BEFORE search, not after.
 *
 * Search pipeline:
 *  1. Build query from user request
 *  2. Apply governed vocabulary expansion (acronyms, product names, synonyms)
 *  3. Restrict to permitted asset IDs and partitions (from routing decision)
 *  4. Apply sensitivity ceiling filter
 *  5. PostgreSQL full-text search (tsvector + tsquery)
 *  6. Hybrid scoring:
 *       - FTS rank (ts_rank)
 *       - Heading/title match boost
 *       - Tag match boost
 *       - Evidence tier weight
 *       - Verification state weight
 *       - Near-duplicate heading path penalty
 *  7. Apply MIN_FINAL_SCORE threshold — exclude weak or irrelevant results
 *  8. Apply diversity: MAX_CHUNKS_PER_ASSET cap and MAX_ASSET_FRACTION cap
 *  9. Apply context budget (chars) and max result count
 * 10. Detect evidential conflicts in result set
 * 11. Safe tag-based fallback ONLY if FTS + vocab expansion find nothing
 * 12. Return scored results with full provenance metadata
 *
 * The unsafe evidence-tier fallback (returning unrelated authoritative chunks)
 * has been removed. No-match queries return an empty result with noResult:true.
 *
 * Search version: retrieval-v1
 * Chunk policy version: chunk-v1
 * Retrieval policy version: retrieval-policy-v1.1
 */

import { inArray, and, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { knowledgeChunksTable } from "@workspace/db/schema";
import type { ManifestAsset } from "../lib/knowledge-manifest";
import { CHUNK_POLICY_VERSION } from "./knowledge-chunking-service";
import { logger } from "../lib/logger";
import {
  RETRIEVAL_POLICY_VERSION,
  RETRIEVAL_THRESHOLDS,
  DOMAIN_VOCABULARY,
  SAFE_FALLBACK_TAG_MAP,
  SCORING_WEIGHTS,
} from "../config/retrieval-policy";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SEARCH_VERSION = "retrieval-v1";

// ── Query preprocessing ───────────────────────────────────────────────────────
//
// Strips question-form filler words before FTS so that auxiliary verbs and
// generic adjectives ("does", "work", "main") do not appear in the AND-query
// and cause spurious noResult for natural language questions.
// The preprocessed text is used only for plainto_tsquery / lexeme extraction;
// the original enriched query is still used for heading/tag boosting.

const QUERY_FILLER_WORDS = new Set([
  // Question words
  "what", "how", "why", "when", "where", "who", "which",
  // Auxiliary / modal verbs
  "does", "doing", "did", "was", "were", "been", "being",
  "has", "have", "had", "will", "would", "could", "should",
  "may", "might", "must", "can", "shall",
  // Generic question-frame verbs
  "mean", "means", "meant", "stand", "stands", "stood",
  "work", "works", "worked",
  "require", "requires", "required",
  "affect", "affects", "affected",
  "involve", "involves", "involved",
  "contain", "contains", "contained",
  "include", "includes", "included",
  "provide", "provides", "provided",
  "help", "helps", "helped",
  "explain", "explains", "describe", "describes",
  "define", "defines",
  // Generic adjectives used in question framing
  "main", "key", "typical", "common", "important",
  "good", "best", "right", "real",
]);

/**
 * Strip question-frame filler words from a query string so that the remaining
 * terms are substantive content words suitable for FTS matching.
 * Short words (< 3 chars) are also removed to avoid noisy single-char stems.
 */
function buildFtsText(query: string): string {
  const tokens = query
    .replace(/[^a-z0-9\s'-]/gi, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !QUERY_FILLER_WORDS.has(w));
  // Deduplicate while preserving order
  const seen = new Set<string>();
  return tokens.filter((t) => seen.has(t) ? false : (seen.add(t), true)).join(" ");
}

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
  /** Max chunks to return (default from policy). */
  maxResults?: number;
  /** Character budget for knowledge content (default from policy). */
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

export interface ConflictRecord {
  headingTopic: string;
  assetIds: string[];
  evidenceTiers: string[];
}

export interface SearchOutput {
  /** Original user query. */
  query: string;
  /** Query after vocabulary expansion. */
  normalisedQuery: string;
  /** Fully enriched query used for FTS (includes lens context signals). */
  enrichedQuery: string;
  /** Labels of vocabulary entries applied. */
  vocabExpansions: string[];
  results: SearchResult[];
  excluded: Array<{ assetId: string; reason: string }>;
  searchVersion: string;
  chunkPolicyVersion: string;
  retrievalPolicyVersion: string;
  candidateCount: number;
  omittedDueToBudget: number;
  /** Candidates excluded because their hybrid score was below MIN_FINAL_SCORE. */
  resultsExcludedBelowThreshold: number;
  /** Near-duplicates removed during diversity enforcement. */
  duplicatesRemoved: number;
  totalCharsSelected: number;
  /** True when no results met the relevance threshold. */
  noResult: boolean;
  /** True when retrieved sources contain potential evidential conflict. */
  conflictDetected: boolean;
  /** Brief description of conflict(s) — for prompt assembly instruction only. */
  conflictDescription?: string;
  /** Conflicts detected (for trace logging). */
  conflicts: ConflictRecord[];
  /** Search latency in milliseconds. */
  searchLatencyMs: number;
}

// ── Query normalisation and vocabulary expansion ──────────────────────────────

interface NormalisationResult {
  normalisedQuery: string;
  enrichedQuery: string;
  appliedExpansions: string[];
}

/**
 * Apply the governed domain vocabulary to the query.
 *
 * Expansions are ADDITIVE — the original term is preserved so FTS can match
 * it directly. Expansions add additional tokens that improve recall.
 *
 * No LLM — fully deterministic.
 */
function normaliseQuery(userQuery: string, _lens?: string): NormalisationResult {
  let normalised = userQuery.trim();
  const appliedExpansions: string[] = [];
  const appendedTokens: string[] = [];

  for (const entry of DOMAIN_VOCABULARY) {
    entry.term.lastIndex = 0;
    if (entry.term.test(normalised)) {
      appendedTokens.push(entry.expansion);
      appliedExpansions.push(entry.label);
    }
  }

  const enriched = appendedTokens.length > 0
    ? `${normalised} ${appendedTokens.join(" ")}`
    : normalised;

  return {
    normalisedQuery: normalised,
    enrichedQuery: enriched.trim(),
    appliedExpansions,
  };
}

// ── Heading match boost ───────────────────────────────────────────────────────

function computeHeadingBoost(headingPath: string, queryTerms: string[]): number {
  const lower = headingPath.toLowerCase();
  let matches = 0;
  for (const term of queryTerms) {
    if (term.length >= 3 && lower.includes(term.toLowerCase())) matches++;
  }
  return Math.min(SCORING_WEIGHTS.HEADING_BOOST_MAX, matches * SCORING_WEIGHTS.HEADING_BOOST_PER_TERM);
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
  return Math.min(SCORING_WEIGHTS.TAG_BOOST_MAX, matches * SCORING_WEIGHTS.TAG_BOOST_PER_TAG);
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Detect potential evidential conflict in the result set.
 *
 * Conflict is flagged when two or more chunks:
 *  - Share the same top-level heading topic (first segment of headingPath), AND
 *  - Come from different assets, AND
 *  - Have different evidence tiers (indicating different authority levels)
 *
 * The retrieval engine does not resolve conflicts — it preserves both fragments
 * and flags the result set so prompt assembly can instruct the model appropriately.
 */
function detectConflicts(results: SearchResult[]): ConflictRecord[] {
  const topicMap = new Map<string, { assetIds: Set<string>; evidenceTiers: Set<string> }>();

  for (const r of results) {
    // Extract top-level heading (first ` > ` segment)
    const topic = r.headingPath.split(" > ")[0]?.trim() ?? r.headingPath;
    if (!topic) continue;

    const entry = topicMap.get(topic) ?? { assetIds: new Set(), evidenceTiers: new Set() };
    entry.assetIds.add(r.assetId);
    entry.evidenceTiers.add(r.evidenceTier);
    topicMap.set(topic, entry);
  }

  const conflicts: ConflictRecord[] = [];
  for (const [topic, { assetIds, evidenceTiers }] of topicMap.entries()) {
    // Conflict: multiple sources for the same topic with different evidence tiers
    if (assetIds.size > 1 && evidenceTiers.size > 1) {
      conflicts.push({
        headingTopic: topic,
        assetIds: [...assetIds],
        evidenceTiers: [...evidenceTiers],
      });
    }
  }

  return conflicts;
}

// ── Safe tag-based fallback ───────────────────────────────────────────────────

/**
 * Safe fallback when FTS finds no results.
 *
 * Maps query keywords to governed tags from SAFE_FALLBACK_TAG_MAP.
 * Only retrieves chunks actually tagged for the queried domain — never
 * returns unrelated high-authority content.
 *
 * This is intentionally conservative: if the query cannot be matched to any
 * known domain tag, it returns empty rather than fabricating relevance.
 */
async function safeTagFallback(
  userQuery: string,
  permittedAssetIds: string[],
  permittedPartitions: string[],
  maxResults: number,
): Promise<Array<{
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
}>> {
  const queryLower = userQuery.toLowerCase();
  const matchedTags = new Set<string>();

  for (const [keyword, tags] of Object.entries(SAFE_FALLBACK_TAG_MAP)) {
    if (queryLower.includes(keyword)) {
      for (const tag of tags) matchedTags.add(tag);
    }
  }

  if (matchedTags.size === 0) {
    return [];
  }

  const tagArray = [...matchedTags];

  const rows = await db
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
        sql`${knowledgeChunksTable.tags} && ARRAY[${sql.join(tagArray.map((t) => sql`${t}`), sql`, `)}]::text[]`,
      ),
    )
    .limit(maxResults);

  return rows.map((r) => ({ ...r, ftsRank: 0 }));
}

// ── Main search function ──────────────────────────────────────────────────────

/**
 * Search the governed chunk index for content relevant to the user query.
 *
 * Security invariant: only chunks belonging to permittedAssetIds and
 * permittedPartitions are ever evaluated. Routing occurs before search.
 *
 * No-match policy: if neither FTS nor safe tag fallback finds relevant content,
 * returns an empty result set with noResult:true. The calling service must
 * NOT fall back to arbitrary high-authority chunks.
 */
export async function searchKnowledge(input: SearchInput): Promise<SearchOutput> {
  const startMs = Date.now();

  const {
    userQuery,
    permittedAssetIds,
    permittedPartitions,
    sensitivityCeiling,
    permittedAssets,
    maxResults = RETRIEVAL_THRESHOLDS.MAX_RESULTS,
    charBudget = RETRIEVAL_THRESHOLDS.MAX_CONTEXT_CHARS,
    activeLens,
  } = input;

  const excluded: Array<{ assetId: string; reason: string }> = [];

  // ── Guard: empty corpus ────────────────────────────────────────────────────

  if (permittedAssetIds.length === 0) {
    return emptyOutput(userQuery, userQuery, [], startMs);
  }

  // ── Vocabulary normalisation ───────────────────────────────────────────────

  const { normalisedQuery, enrichedQuery, appliedExpansions } = normaliseQuery(userQuery, activeLens);

  // Build query terms for heading/tag boosting
  const queryTerms = enrichedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 30);

  // ── Build asset title map ──────────────────────────────────────────────────

  const assetTitleMap: Record<string, string> = {};
  for (const a of permittedAssets) {
    assetTitleMap[a.id] = a.title;
  }

  // ── FTS search ─────────────────────────────────────────────────────────────
  //
  // Uses Drizzle's typed query builder with inArray() for array parameters —
  // avoids the raw db.execute() + ANY($array) binding issue where JS arrays are
  // not correctly serialised as PostgreSQL array types.

  type ChunkRow = {
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
  };

  let rows: ChunkRow[] = [];
  let usedTagFallback = false;

  // Build the FTS query text: strip filler/question-frame words so that
  // "How does business continuity management work?" reduces to
  // "business continuity management" — avoiding spurious noResult cases
  // where auxiliary verbs aren't in the knowledge content.
  const ftsText = buildFtsText(enrichedQuery) || enrichedQuery;

  // OR-based FTS using PostgreSQL lexeme union.
  // Converts ftsText → tsvector → extracts unique lexemes → joins with ' | '
  // → to_tsquery OR expression. This matches any chunk containing at least one
  // query stem, with ts_rank weighting by how many stems matched.
  // Handles ftsText with no tsvector lexemes (all stop words) by falling back
  // to a tsquery that matches everything — the scoring threshold filters irrelevant.
  const orTsquery = sql`(
    SELECT COALESCE(
      to_tsquery('english', string_agg(lexeme, ' | ')),
      to_tsquery('english', 'content')
    )
    FROM unnest(to_tsvector('english', ${ftsText}))
  )`;

  const chunkTsvector = sql`to_tsvector('english', coalesce(${knowledgeChunksTable.headingPath}, '') || ' ' || ${knowledgeChunksTable.content})`;

  // ts_rank expression — referenced in both SELECT and ORDER BY
  const ftsRankExpr = sql<number>`ts_rank(${chunkTsvector}, ${orTsquery}, 32)`;

  const ftsMatchExpr = sql`${chunkTsvector} @@ ${orTsquery}`;

  try {
    rows = await db
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
        ftsRank: ftsRankExpr,
      })
      .from(knowledgeChunksTable)
      .where(
        and(
          inArray(knowledgeChunksTable.assetId, permittedAssetIds),
          inArray(knowledgeChunksTable.partition, permittedPartitions),
          ftsMatchExpr,
        ),
      )
      .orderBy(desc(ftsRankExpr))
      .limit(RETRIEVAL_THRESHOLDS.MAX_CANDIDATES) as ChunkRow[];
  } catch (err) {
    logger.error({ err }, "knowledge-search-service: FTS query failed — attempting tag fallback");
  }

  // ── Safe tag-based fallback (not arbitrary high-authority chunks) ──────────
  //
  // Only used when FTS finds nothing. Maps query keywords to governed content
  // tags — returns empty if no tag match exists.

  if (rows.length === 0) {
    try {
      rows = await safeTagFallback(
        normalisedQuery,
        permittedAssetIds,
        permittedPartitions,
        RETRIEVAL_THRESHOLDS.MAX_CANDIDATES,
      );
      usedTagFallback = rows.length > 0;
    } catch (err) {
      logger.error({ err }, "knowledge-search-service: tag fallback failed");
      rows = [];
    }
  }

  const candidateCount = rows.length;

  // If nothing found at all — return empty, record no-result
  if (candidateCount === 0) {
    return {
      ...emptyOutput(userQuery, normalisedQuery, appliedExpansions, startMs),
      enrichedQuery,
      noResult: true,
    };
  }

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

  // ── Hybrid scoring ─────────────────────────────────────────────────────────

  const seenHeadingPaths = new Set<string>();
  let duplicatesRemoved = 0;

  const scored: SearchResult[] = sensitivityFiltered.map((r) => {
    const title = assetTitleMap[r.assetId] ?? r.assetId;
    const ftsRank = r.ftsRank;

    const headingBoost = computeHeadingBoost(r.headingPath, queryTerms);
    const tagBoost = computeTagBoost(r.tags, queryTerms);
    const evidenceTierWeight = SCORING_WEIGHTS.EVIDENCE_TIER[r.evidenceTier] ?? 0;
    const verificationWeight = SCORING_WEIGHTS.VERIFICATION_STATE[r.verificationState] ?? 0;

    // Near-duplicate penalty: same headingPath already seen in result candidates
    let duplicatePenalty = 0;
    if (seenHeadingPaths.has(r.headingPath)) {
      duplicatePenalty = SCORING_WEIGHTS.DUPLICATE_HEADING_PENALTY;
      duplicatesRemoved++;
    }
    seenHeadingPaths.add(r.headingPath);

    // Apply FTS multiplier so topic relevance dominates authority tier boosts
    const ftsRankScore = ftsRank * SCORING_WEIGHTS.FTS_RANK_MULTIPLIER;
    const total = ftsRankScore + headingBoost + tagBoost + evidenceTierWeight + verificationWeight + duplicatePenalty;

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

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // ── MIN_FINAL_SCORE threshold ──────────────────────────────────────────────
  //
  // Tag fallback results bypass the FTS score gate (ftsRank = 0) but still
  // need a minimum metadata-derived score to be included.
  // FTS results must also clear the minimum threshold.

  let resultsExcludedBelowThreshold = 0;
  const aboveThreshold = scored.filter((r) => {
    const passes = usedTagFallback
      ? r.score >= RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE
      : r.scoreBreakdown.ftsRank >= RETRIEVAL_THRESHOLDS.MIN_FTS_SCORE &&
        r.score >= RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE;
    if (!passes) resultsExcludedBelowThreshold++;
    return passes;
  });

  if (aboveThreshold.length === 0) {
    return {
      ...emptyOutput(userQuery, normalisedQuery, appliedExpansions, startMs),
      enrichedQuery,
      noResult: true,
      candidateCount,
      resultsExcludedBelowThreshold,
      duplicatesRemoved,
      excluded,
      searchLatencyMs: Date.now() - startMs,
    };
  }

  // ── Diversity enforcement ─────────────────────────────────────────────────
  //
  // MAX_CHUNKS_PER_ASSET: prevent one large asset from dominating context.
  // MAX_ASSET_FRACTION: cap the proportion of context chars from one asset.
  //
  // Both caps are applied during result selection below (budget phase).

  const assetChunkCounts: Record<string, number> = {};

  // ── Context budget + diversity selection ─────────────────────────────────

  const selected: SearchResult[] = [];
  let totalChars = 0;
  let omittedDueToBudget = 0;

  for (const result of aboveThreshold) {
    if (selected.length >= maxResults) {
      omittedDueToBudget++;
      continue;
    }

    // Per-asset chunk cap
    const assetChunksUsed = assetChunkCounts[result.assetId] ?? 0;
    if (assetChunksUsed >= RETRIEVAL_THRESHOLDS.MAX_CHUNKS_PER_ASSET) {
      omittedDueToBudget++;
      continue;
    }

    // Asset fraction cap (applied only when we have some context already)
    if (totalChars > 0) {
      const projectedAssetChars =
        selected
          .filter((s) => s.assetId === result.assetId)
          .reduce((sum, s) => sum + s.content.length, 0) + result.content.length;
      const projectedTotal = totalChars + result.content.length;
      if (
        projectedTotal > 0 &&
        projectedAssetChars / projectedTotal > RETRIEVAL_THRESHOLDS.MAX_ASSET_FRACTION
      ) {
        omittedDueToBudget++;
        continue;
      }
    }

    // Character budget
    if (totalChars + result.content.length > charBudget) {
      omittedDueToBudget++;
      continue;
    }

    selected.push(result);
    totalChars += result.content.length;
    assetChunkCounts[result.assetId] = (assetChunkCounts[result.assetId] ?? 0) + 1;
  }

  // ── Conflict detection ────────────────────────────────────────────────────

  const conflicts = detectConflicts(selected);
  const conflictDetected = conflicts.length > 0;
  let conflictDescription: string | undefined;

  if (conflictDetected) {
    const topics = conflicts.map((c) => c.headingTopic).join("; ");
    conflictDescription =
      `Multiple sources with different authority levels address: ${topics}. ` +
      `Distinguish clearly between authoritative fact, current operational understanding, and unverified claims.`;
  }

  return {
    query: userQuery,
    normalisedQuery,
    enrichedQuery,
    vocabExpansions: appliedExpansions,
    results: selected,
    excluded,
    searchVersion: SEARCH_VERSION,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    retrievalPolicyVersion: RETRIEVAL_POLICY_VERSION,
    candidateCount,
    omittedDueToBudget,
    resultsExcludedBelowThreshold,
    duplicatesRemoved,
    totalCharsSelected: totalChars,
    noResult: false,
    conflictDetected,
    conflictDescription,
    conflicts,
    searchLatencyMs: Date.now() - startMs,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyOutput(
  query: string,
  normalisedQuery: string,
  vocabExpansions: string[],
  startMs: number,
): SearchOutput {
  return {
    query,
    normalisedQuery,
    enrichedQuery: normalisedQuery,
    vocabExpansions,
    results: [],
    excluded: [],
    searchVersion: SEARCH_VERSION,
    chunkPolicyVersion: CHUNK_POLICY_VERSION,
    retrievalPolicyVersion: RETRIEVAL_POLICY_VERSION,
    candidateCount: 0,
    omittedDueToBudget: 0,
    resultsExcludedBelowThreshold: 0,
    duplicatesRemoved: 0,
    totalCharsSelected: 0,
    noResult: true,
    conflictDetected: false,
    conflicts: [],
    searchLatencyMs: Date.now() - startMs,
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

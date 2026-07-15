---
name: RAG Engine v1.1 retrieval hardening
description: Key decisions and constraints from the Phase 2 RAG Engine v1.1 implementation — corpus expansion, retrieval quality hardening, evaluation runner.
---

## Retrieval policy source of truth

`artifacts/api-server/src/config/retrieval-policy.ts` is the single source of truth for:
- `RETRIEVAL_POLICY_VERSION` = "retrieval-policy-v1.1"
- `RETRIEVAL_THRESHOLDS` (MIN_FTS_SCORE, MIN_FINAL_SCORE, MAX_CHUNKS_PER_ASSET, MAX_ASSET_FRACTION, MAX_CONTEXT_CHARS, MAX_CANDIDATES, MAX_RESULTS, DUPLICATE_HEADING_PENALTY, NEAR_DUPLICATE_HEADING_MATCH)
- `DOMAIN_VOCABULARY` — 35+ governed term → expansion entries (regex-based, case-insensitive)
- `SAFE_FALLBACK_TAG_MAP` — keyword → tag array for safe tag-based fallback
- `SCORING_WEIGHTS` — heading boost, tag boost, evidence tier, verification state, duplicate penalty

All services must import from this config rather than using inline constants.

## No unsafe evidence-tier fallback

The old fallback (return all chunks by evidence tier when FTS finds nothing) was removed.
The only permitted fallback is tag-based (SAFE_FALLBACK_TAG_MAP). If neither FTS nor tag fallback finds content, return `noResult: true` — never return unrelated authoritative chunks.

**Why:** Returning high-authority chunks unrelated to the query pollutes model context with false relevance, potentially generating confident hallucinations grounded in irrelevant governance content.

**How to apply:** Any new fallback path must be explicitly scoped to the query domain. Pattern: check SAFE_FALLBACK_TAG_MAP → find matching tags → query only chunks tagged with those tags.

## New retrieval trace columns (DB v1.1)

Added to `retrieval_traces` table (nullable, backwards-compatible):
- `normalised_query` (text) — query after vocabulary expansion
- `vocab_expansions` (text[]) — expansion labels applied
- `retrieval_policy_version` (varchar 64) — policy in effect at search time
- `results_excluded_below_threshold` (int)
- `duplicates_removed` (int)
- `no_result` (boolean)
- `conflict_detected` (boolean)
- `search_latency_ms` (int)

Always run `pnpm --filter @workspace/db run push-force` after adding columns.

## Conflict detection semantics

Conflict is flagged when 2+ selected chunks share the same top-level heading (first ` > ` segment of headingPath) but come from different assets with different evidence tiers.
The engine does NOT resolve conflicts — it preserves both fragments and sets `conflictDetected: true` + `conflictDescription` for prompt assembly to instruct the model.

## Evaluation runner

`artifacts/api-server/src/scripts/evaluate-retrieval.ts` runs against `evaluation/retrieval-evaluation-v1.json` (46 cases).
- Exit 1 = security boundary violation (prohibited partition/asset accessed)
- Exit 2 = quality gate failure (Top-1 < 60%, Recall@5 < 75%, irrelevant rate > 20%, P95 > 1000ms)
- Exit 3 = runner error (DB, fixture parse)
- Run: `pnpm --filter @workspace/api-server run evaluate:retrieval`

The runner builds permitted asset lists by lens using a simplified lens→partition map — must stay in sync with the runtime lens policy.

## Manifest validation

`validateManifest()` in `knowledge-manifest.ts` checks: no duplicate IDs/paths, valid partition/sensitivity/verificationState/status, restricted assets have `suppliedToLlm: false`, placeholder assets have `suppliedToLlm: false`, LLM-eligible active assets have owner + lastReviewedDate.
Called in `GET /admin/knowledge/index/status` and `GET /admin/knowledge/manifest`.

## Admin corpus endpoint

`GET /admin/knowledge/corpus` returns chunk counts by asset, partition, sensitivity, and evidence tier — uses raw SQL aggregates against `knowledge_chunks`. Useful for post-reindex verification.

## Knowledge corpus (Phase 2 — 10 domain files active)

All domain files are partition: "neutral", sensitivity: "public", verificationState: "draft", status: "active", suppliedToLlm: true:
grc-domain, third-party-risk-domain, compliance-domain, internal-audit-domain, operational-risk-domain, policy-management-domain, cyber-security-domain, regulations-domain, industries-knowledge, competitors-intelligence.

competitors-intelligence is partition: "intelligence", sensitivity: "internal" — only accessible under intelligence lens.
knowledge-governance stays partition: "restricted", suppliedToLlm: false.

# 99_Build_History.md

Append-only record of completed engine milestones.

---

## 2026-07-15 — Phase 2 RAG Engine v1.1 (Retrieval Acceptance)

**Engine:** Knowledge / Retrieval Engine  
**Branch:** `feature/development-orchestrator-foundation`  
**Commit:** `b747652` — Improve search relevance and recall by optimizing full-text search  
**Architect:** RRAI Platform Agent  

### Summary

Completed Phase 2 acceptance validation for the RAG Engine. All retrieval quality gates passed after three targeted fixes.

### Root Causes Fixed

1. **`db.execute()` + ANY($array) silent failure** — Drizzle raw SQL executor did not bind JS arrays as PostgreSQL array types; all FTS queries silently threw and returned 0 candidates. Fixed by switching to `db.select().where(inArray(...))` which handles arrays correctly.

2. **`plainto_tsquery` AND-strictness for NL questions** — PostgreSQL does not treat "does", "work", "main" as stop words; natural-language questions caused spurious noResult. Fixed by: (a) adding `buildFtsText()` filler-word stripping function, (b) switching FTS from AND to OR-based lexeme union via `to_tsvector` unnest → `string_agg(lexeme, ' | ')`.

3. **Evidence tier authority bias** — `governed+approved` fixed bonus (+0.40) consistently outranked more relevant draft domain content. Fixed by reducing EVIDENCE_TIER weights to ≤0.05 max and adding `FTS_RANK_MULTIPLIER: 2.0` so topic relevance dominates authority tier.

4. **BCP vocabulary expansion** — "planning" not matching BCM content that uses "management"; added "management" to BCP expansion.

5. **`run-reindex.ts` TS errors** — `chunksCreated`/`chunksFailed` corrected to `chunksAdded`/`chunksUpdated`.

### Acceptance Gate Results

| Gate | Threshold | Result |
|---|---|---|
| Recall@5 | ≥85% | 100.0% ✅ |
| Top-1 accuracy | ≥70% | 77.4% ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| Security violations | 0 | 0 ✅ |
| P95 latency | <1000ms | 16ms ✅ |
| TypeScript | Zero errors | ✅ |
| Tests | All pass | 19/19 ✅ |
| Build | Pass | api-server ✅ |

### Files Changed

- `artifacts/api-server/src/services/knowledge-search-service.ts` — FTS rewrite (OR lexeme union, filler-word stripping, inArray, FTS_RANK_MULTIPLIER)
- `artifacts/api-server/src/config/retrieval-policy.ts` — v1.2, reduced weights, BCP expansion fix
- `artifacts/api-server/src/scripts/run-reindex.ts` — TS property names fixed

### Architecture Impact

- Retrieval policy version bumped to v1.2
- OR-based FTS is now the standard retrieval pattern for RRAI
- Evidence tier weights established at ≤0.05 as a platform principle

---

## 2026-07-15 — Platform Governance Engine v1

**Engine:** Platform Governance & Synchronisation  
**Branch:** `feature/development-orchestrator-foundation`  
**Commit:** `b747652`  
**Architect:** RRAI Platform Agent  

### Summary

Implemented the Platform Governance & Synchronisation Engine. The generator inspects the live repository (git, schema, routes, tests, knowledge manifest, CI) and produces 10 authoritative implementation documents that serve as the accurate snapshot of platform state for Claude and human architects.

### Implemented

- `scripts/src/generate-platform-status.ts` — generator script
- `scripts/package.json` — `generate:platform-status` script entry
- `implementation/00_Platform_Status.md` through `implementation/08_Build_Status.md` — generated
- `implementation/99_Build_History.md` — append-only history initialised

### Files Changed

- `scripts/src/generate-platform-status.ts` (new)
- `scripts/package.json` (script entry added)
- `implementation/` (all 10 documents generated)

### Architecture Impact

- Documents become the authoritative implementation snapshot
- Claude workflow: read 00_RRAI_Master_Context_v2_0.md → 01_RRAI_Platform_Architecture_v1_0.md → implementation/00_Platform_Status.md before any architectural guidance
- Generator must be re-run after each major engine milestone

---

## 2026-07-15 — Phase 2 RAG Engine v1.1 (Retrieval Acceptance)

**Engine:** Knowledge / Retrieval Engine  
**Branch:** `feature/development-orchestrator-foundation`  
**Commit:** `b747652` — Improve search relevance and recall by optimizing full-text search  
**Architect:** RRAI Platform Agent  

### Summary

Completed Phase 2 acceptance validation for the RAG Engine. All retrieval quality gates passed after three targeted fixes.

### Root Causes Fixed

1. **`db.execute()` + ANY($array) silent failure** — Drizzle raw SQL executor did not bind JS arrays as PostgreSQL array types; all FTS queries silently threw and returned 0 candidates. Fixed by switching to `db.select().where(inArray(...))` which handles arrays correctly.

2. **`plainto_tsquery` AND-strictness for NL questions** — PostgreSQL does not treat "does", "work", "main" as stop words; natural-language questions caused spurious noResult. Fixed by: (a) adding `buildFtsText()` filler-word stripping function, (b) switching FTS from AND to OR-based lexeme union via `to_tsvector` unnest → `string_agg(lexeme, ' | ')`.

3. **Evidence tier authority bias** — `governed+approved` fixed bonus (+0.40) consistently outranked more relevant draft domain content. Fixed by reducing EVIDENCE_TIER weights to ≤0.05 max and adding `FTS_RANK_MULTIPLIER: 2.0` so topic relevance dominates authority tier.

4. **BCP vocabulary expansion** — "planning" not matching BCM content that uses "management"; added "management" to BCP expansion.

5. **`run-reindex.ts` TS errors** — `chunksCreated`/`chunksFailed` corrected to `chunksAdded`/`chunksUpdated`.

### Acceptance Gate Results

| Gate | Threshold | Result |
|---|---|---|
| Recall@5 | ≥85% | 100.0% ✅ |
| Top-1 accuracy | ≥70% | 77.4% ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| Security violations | 0 | 0 ✅ |
| P95 latency | <1000ms | 16ms ✅ |
| TypeScript | Zero errors | ✅ |
| Tests | All pass | 19/19 ✅ |
| Build | Pass | api-server ✅ |

### Files Changed

- `artifacts/api-server/src/services/knowledge-search-service.ts` — FTS rewrite (OR lexeme union, filler-word stripping, inArray, FTS_RANK_MULTIPLIER)
- `artifacts/api-server/src/config/retrieval-policy.ts` — v1.2, reduced weights, BCP expansion fix
- `artifacts/api-server/src/scripts/run-reindex.ts` — TS property names fixed

### Architecture Impact

- Retrieval policy version bumped to v1.2
- OR-based FTS is now the standard retrieval pattern for RRAI
- Evidence tier weights established at ≤0.05 as a platform principle

---

## 2026-07-15 — Platform Governance Engine v1

**Engine:** Platform Governance & Synchronisation  
**Branch:** `feature/development-orchestrator-foundation`  
**Commit:** `b747652`  
**Architect:** RRAI Platform Agent  

### Summary

Implemented the Platform Governance & Synchronisation Engine. The generator inspects the live repository (git, schema, routes, tests, knowledge manifest, CI) and produces 10 authoritative implementation documents that serve as the accurate snapshot of platform state for Claude and human architects.

### Implemented

- `scripts/src/generate-platform-status.ts` — generator script
- `scripts/package.json` — `generate:platform-status` script entry
- `implementation/00_Platform_Status.md` through `implementation/08_Build_Status.md` — generated
- `implementation/99_Build_History.md` — append-only history initialised

### Files Changed

- `scripts/src/generate-platform-status.ts` (new)
- `scripts/package.json` (script entry added)
- `implementation/` (all 10 documents generated)

### Architecture Impact

- Documents become the authoritative implementation snapshot
- Claude workflow: read 00_RRAI_Master_Context_v2_0.md → 01_RRAI_Platform_Architecture_v1_0.md → implementation/00_Platform_Status.md before any architectural guidance
- Generator must be re-run after each major engine milestone

---

## Platform Governance Engine v1.1 — Hardened for CI

**Date:** 2026-07-15  
**Branch:** `feature/development-orchestrator-foundation`  
**Commit:** `c23c100` (Add query client provider to enable data fetching)  
**Commit Date:** 2026-07-15 14:53:15 +0000  
**Tests:** 21/21  
**Notes:** Deterministic generation; removed timestamps; added check/record-history commands; CI integration  

---


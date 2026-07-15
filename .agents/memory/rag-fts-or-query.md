---
name: RAG FTS OR-query pattern
description: Why plainto_tsquery fails for NL questions and the lexeme-union fix used in Phase 2.
---

## Rule
Use OR-based FTS (lexeme union from `to_tsvector` unnest) rather than `plainto_tsquery` (AND) for natural-language question retrieval. Strip question-frame filler words before FTS.

## Why
`plainto_tsquery` creates an AND query requiring ALL non-stop words. Natural language questions contain auxiliary verbs ("does", "work") and adjectives ("main", "key") that are not PostgreSQL stop words but are also not present in knowledge content — causing silent noResult for valid queries. "How does business continuity management work?" requires "doe" & "busi" & "continu" & "manag" & "work"; the knowledge file has the last three but not "doe" or "work" in BCM context.

## How to apply
In `knowledge-search-service.ts`:
1. `buildFtsText()` strips QUERY_FILLER_WORDS (question words, auxiliaries, generic adjectives) from the enriched query.
2. OR tsquery built from lexeme union: `SELECT COALESCE(to_tsquery('english', string_agg(lexeme, ' | ')), to_tsquery('english', 'content')) FROM unnest(to_tsvector('english', $ftsText))`.
3. ts_rank still produces relevance ordering — OR matching only widens the candidate set; scoring filters noise.

## Evidence tier / authority bias fix
`governed+approved` fixed boosts (was 0.25+0.15=0.40) consistently outranked relevant draft domain content. Fix: reduce all tier weights to ≤0.05 and add `FTS_RANK_MULTIPLIER: 2.0` so ts_rank dominates. Rule: the max fixed authority bonus must be less than a 0.05 difference in ts_rank.

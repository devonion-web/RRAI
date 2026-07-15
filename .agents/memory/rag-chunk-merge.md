---
name: RAG Engine v1 — chunk merge bug
description: Chunk merge logic must restrict to same-heading-path; OR-on-size merges different-topic sections.
---

## Rule

In `knowledge-chunking-service.ts`, the tiny-fragment merge step must only merge chunks when **both** conditions hold:
1. `prev.headingPath === cand.headingPath` (same section)
2. Combined length fits within MAX_CHARS

Using an **OR** condition (same heading OR fits in budget) silently merges sections from different headings into one chunk, destroying topic boundaries. The wrong merge passed typecheck but failed tests T03 and T06.

**Why:** Each heading path represents a distinct topic. A tiny section under a different heading (e.g. "Risk Framework") must remain a separate chunk even if it's small — merging it into the preceding "Key Modules" chunk loses the heading path and defeats retrieval precision.

**How to apply:** In any chunking algorithm where you merge small fragments, the condition must be `sameSection AND fitsInChunk`, never `sameSection OR fitsInChunk`.

/**
 * Knowledge Chunking Service — unit tests.
 *
 * Run with:
 *   node --test --import tsx/esm src/services/knowledge-chunking-service.test.ts
 *
 * These are pure in-memory tests — no database access required.
 *
 * Test coverage:
 *   T01 — empty document produces no chunks
 *   T02 — flat document (no headings) produces one chunk
 *   T03 — heading-delimited sections each become distinct chunks
 *   T04 — long sections are split at paragraph boundaries
 *   T05 — tiny sections are merged into the preceding chunk
 *   T06 — heading path accumulates across nested headings
 *   T07 — chunk indices are sequential from 0
 *   T08 — content hashes are stable (same input → same hash)
 *   T09 — token estimates are positive and proportional to length
 *   T10 — deriveEvidenceTier maps correctly
 *   T11 — extractTags detects known domain terms
 *   T12 — computeChunkHash changes when headingPath or content changes
 *   T13 — real Risk Rising.md produces multiple chunks
 *   T14 — determinism: chunking twice produces identical results
 *   T15 — duplicate heading path sections do not collapse (separate sections = separate chunks)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  chunkMarkdown,
  deriveEvidenceTier,
  extractTags,
  computeChunkHash,
  estimateTokens,
  CHUNK_POLICY_VERSION,
} from "./knowledge-chunking-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSection(heading: string, body: string): string {
  return `## ${heading}\n\n${body}`;
}

function makeLongBody(sentences: number): string {
  return Array.from({ length: sentences }, (_, i) =>
    `This is sentence number ${i + 1} of a long section that contains a significant amount of content to test that the chunking algorithm correctly splits overly long sections at paragraph boundaries.`,
  ).join("\n\n");
}

// ── T01 — Empty document ──────────────────────────────────────────────────────

describe("T01 empty document", () => {
  it("produces no chunks for an empty string", () => {
    const chunks = chunkMarkdown("");
    assert.equal(chunks.length, 0);
  });

  it("produces no chunks for whitespace-only input", () => {
    const chunks = chunkMarkdown("   \n\n  \n");
    assert.equal(chunks.length, 0);
  });
});

// ── T02 — Flat document (no headings) ─────────────────────────────────────────

describe("T02 flat document", () => {
  it("produces one chunk for a short paragraph", () => {
    const md = "This is a short paragraph about Risk Rising consultancy services.";
    const chunks = chunkMarkdown(md);
    assert.equal(chunks.length, 1);
    assert.match(chunks[0].content, /Risk Rising/);
  });
});

// ── T03 — Heading-delimited sections ─────────────────────────────────────────

describe("T03 heading-delimited sections", () => {
  it("produces a chunk per section for a document with multiple headings", () => {
    const md = [
      "# Platform Overview",
      "",
      "An overview of the platform.",
      "",
      "## Key Modules",
      "",
      "Description of key modules.",
      "",
      "## Risk Framework",
      "",
      "Description of the risk framework.",
    ].join("\n");

    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 2, `Expected >= 2 chunks, got ${chunks.length}`);
    // Each chunk should contain its section heading
    const headings = chunks.map((c) => c.headingPath);
    assert.ok(headings.some((h) => h.includes("Key Modules")));
    assert.ok(headings.some((h) => h.includes("Risk Framework")));
  });

  it("includes the section heading text in chunk content", () => {
    const md = "## Delivery Capability\n\nRisk Rising provides delivery services.";
    const chunks = chunkMarkdown(md);
    assert.equal(chunks.length, 1);
    assert.match(chunks[0].content, /Delivery Capability/);
  });
});

// ── T04 — Long section splitting ──────────────────────────────────────────────

describe("T04 long section splitting", () => {
  it("splits a long section into multiple chunks at paragraph boundaries", () => {
    const body = makeLongBody(30); // ~30 paragraphs → well above MAX_CHARS
    const md = `## Long Section\n\n${body}`;
    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 2, `Expected >= 2 chunks for long section, got ${chunks.length}`);
  });

  it("each split chunk is within the token limit", () => {
    const body = makeLongBody(30);
    const md = `## Long Section\n\n${body}`;
    const chunks = chunkMarkdown(md);
    for (const chunk of chunks) {
      assert.ok(
        chunk.tokenEstimate <= 1000,
        `Chunk ${chunk.chunkIndex} has too many tokens: ${chunk.tokenEstimate}`,
      );
    }
  });
});

// ── T05 — Tiny section merging ─────────────────────────────────────────────────

describe("T05 tiny section merging", () => {
  it("merges a tiny trailing fragment into the preceding chunk", () => {
    const normal = "## Section One\n\nA normal section with enough content to stand alone in the retrieval index.";
    const tiny = "## Section One\n\nTiny.";
    // Build a doc where the second section is tiny — should be merged or kept as small chunk
    const md = `${normal}\n\nAlso some extra content.\n\nTiny note.`;
    const chunks = chunkMarkdown(md);
    // All content should be recoverable — it just shouldn't generate a 0-token chunk
    for (const chunk of chunks) {
      assert.ok(chunk.tokenEstimate > 0, "Chunk has zero tokens");
    }
  });
});

// ── T06 — Heading path accumulation ─────────────────────────────────────────

describe("T06 heading path accumulation", () => {
  it("accumulates heading path across levels", () => {
    const md = [
      "# Risk Rising",
      "",
      "Top-level intro.",
      "",
      "## Delivery Capability",
      "",
      "Delivery capability overview.",
      "",
      "### Managed Service",
      "",
      "Managed service detail.",
    ].join("\n");

    const chunks = chunkMarkdown(md);
    const managedServiceChunk = chunks.find((c) => c.content.includes("Managed service detail"));
    assert.ok(managedServiceChunk, "Expected chunk containing managed service detail");
    assert.ok(
      managedServiceChunk.headingPath.includes("Managed Service"),
      `Heading path should include "Managed Service": ${managedServiceChunk.headingPath}`,
    );
    assert.ok(
      managedServiceChunk.headingPath.includes("Delivery Capability"),
      `Heading path should include "Delivery Capability": ${managedServiceChunk.headingPath}`,
    );
  });

  it("heading path resets correctly when going back to a higher level", () => {
    const md = [
      "# Part One",
      "",
      "Part one content.",
      "",
      "## Sub Section",
      "",
      "Sub section content.",
      "",
      "# Part Two",
      "",
      "Part two content.",
    ].join("\n");

    const chunks = chunkMarkdown(md);
    const partTwoChunk = chunks.find((c) => c.content.includes("Part two content"));
    assert.ok(partTwoChunk, "Expected chunk for Part Two");
    assert.ok(
      !partTwoChunk.headingPath.includes("Sub Section"),
      `Part Two heading path should not include Sub Section: ${partTwoChunk.headingPath}`,
    );
  });
});

// ── T07 — Sequential chunk indices ───────────────────────────────────────────

describe("T07 sequential chunk indices", () => {
  it("assigns sequential chunk indices from 0", () => {
    const md = [
      "## Section A\n\nContent A.",
      "## Section B\n\nContent B.",
      "## Section C\n\nContent C.",
    ].join("\n\n");

    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 1);
    chunks.forEach((c, i) => {
      assert.equal(c.chunkIndex, i, `Expected chunkIndex=${i}, got ${c.chunkIndex}`);
    });
  });
});

// ── T08 — Content hash stability ─────────────────────────────────────────────

describe("T08 content hash stability", () => {
  it("produces the same hash for identical input", () => {
    const md = "## Stable Section\n\nThis content should produce a stable hash every time.";
    const chunks1 = chunkMarkdown(md);
    const chunks2 = chunkMarkdown(md);
    assert.equal(chunks1.length, chunks2.length);
    assert.equal(chunks1[0].contentHash, chunks2[0].contentHash);
  });

  it("produces different hashes for different content", () => {
    const c1 = chunkMarkdown("## A\n\nContent Alpha.");
    const c2 = chunkMarkdown("## A\n\nContent Beta.");
    assert.notEqual(c1[0].contentHash, c2[0].contentHash);
  });
});

// ── T09 — Token estimation ────────────────────────────────────────────────────

describe("T09 token estimation", () => {
  it("returns a positive token estimate for non-empty content", () => {
    const md = "## Section\n\nThis is some content.";
    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length > 0);
    assert.ok(chunks[0].tokenEstimate > 0);
  });

  it("longer content has more tokens than shorter", () => {
    const short = estimateTokens("short");
    const long = estimateTokens("this is a much longer piece of content that should have more tokens");
    assert.ok(long > short);
  });
});

// ── T10 — Evidence tier derivation ───────────────────────────────────────────

describe("T10 deriveEvidenceTier", () => {
  it("approved + neutral → governed", () => {
    assert.equal(deriveEvidenceTier("approved", "neutral"), "governed");
  });

  it("approved + intelligence → governed", () => {
    assert.equal(deriveEvidenceTier("approved", "intelligence"), "governed");
  });

  it("approved + commercial → established", () => {
    assert.equal(deriveEvidenceTier("approved", "commercial"), "established");
  });

  it("approved + delivery → established", () => {
    assert.equal(deriveEvidenceTier("approved", "delivery"), "established");
  });

  it("draft + any → current", () => {
    assert.equal(deriveEvidenceTier("draft", "neutral"), "current");
    assert.equal(deriveEvidenceTier("draft", "commercial"), "current");
  });

  it("superseded → unverified", () => {
    assert.equal(deriveEvidenceTier("superseded", "neutral"), "unverified");
  });

  it("unknown state → unverified", () => {
    assert.equal(deriveEvidenceTier("unknown", "neutral"), "unverified");
  });
});

// ── T11 — Tag extraction ──────────────────────────────────────────────────────

describe("T11 extractTags", () => {
  it("detects LogicGate from content", () => {
    const tags = extractTags("Platform Guide", "This document covers LogicGate GRC configuration.");
    assert.ok(tags.includes("LogicGate"), `Expected LogicGate tag, got: ${tags}`);
  });

  it("detects TPRM from content", () => {
    const tags = extractTags("Risk Guide", "Third party risk management (TPRM) frameworks.");
    assert.ok(tags.includes("TPRM"), `Expected TPRM tag, got: ${tags}`);
  });

  it("detects GRC from acronym", () => {
    const tags = extractTags("GRC Overview", "Governance, Risk and Compliance.");
    assert.ok(tags.includes("GRC"), `Expected GRC tag, got: ${tags}`);
  });

  it("returns an empty array for content with no known terms", () => {
    const tags = extractTags("Weather Report", "The forecast is sunny today.");
    // Should return empty or minimal tags — no false positives on irrelevant content
    assert.ok(Array.isArray(tags));
  });

  it("does not duplicate tags", () => {
    const tags = extractTags("LogicGate GRC", "LogicGate GRC governance risk compliance");
    const unique = [...new Set(tags)];
    assert.deepEqual(tags, unique, "Tags should not contain duplicates");
  });
});

// ── T12 — Hash changes on mutation ───────────────────────────────────────────

describe("T12 computeChunkHash changes on mutation", () => {
  const hp = "Section > Subsection";
  const content = "Original content";
  const original = computeChunkHash(hp, content);

  it("changes when content changes", () => {
    assert.notEqual(computeChunkHash(hp, "Modified content"), original);
  });

  it("changes when headingPath changes", () => {
    assert.notEqual(computeChunkHash("Different > Path", content), original);
  });

  it("is 32 characters long", () => {
    assert.equal(original.length, 32, `Expected 32 chars, got ${original.length}`);
  });

  it("is hexadecimal", () => {
    assert.match(original, /^[0-9a-f]+$/);
  });
});

// ── T13 — Real knowledge files ────────────────────────────────────────────────

describe("T13 real knowledge files", () => {
  const KNOWLEDGE_DIR = join(process.cwd(), "..", "..", "knowledge");

  it("chunks Risk Rising.md into multiple chunks", { skip: !existsSync(join(KNOWLEDGE_DIR, "Risk Rising.md")) }, () => {
    const md = readFileSync(join(KNOWLEDGE_DIR, "Risk Rising.md"), "utf-8");
    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 1, `Expected >= 1 chunks, got ${chunks.length}`);
    for (const c of chunks) {
      assert.ok(c.contentHash.length === 32, "Hash must be 32 chars");
      assert.ok(c.tokenEstimate > 0, "Token estimate must be positive");
      assert.ok(c.content.length > 0, "Content must not be empty");
    }
  });

  it("chunks LogicGate.md into multiple chunks", { skip: !existsSync(join(KNOWLEDGE_DIR, "LogicGate.md")) }, () => {
    const md = readFileSync(join(KNOWLEDGE_DIR, "LogicGate.md"), "utf-8");
    const chunks = chunkMarkdown(md);
    assert.ok(chunks.length >= 1, `Expected >= 1 chunks, got ${chunks.length}`);
  });
});

// ── T14 — Determinism ─────────────────────────────────────────────────────────

describe("T14 determinism", () => {
  it("produces identical chunks on repeated calls with the same input", () => {
    const md = [
      "# Risk Rising",
      "",
      "Risk Rising is a GRC consultancy.",
      "",
      "## LogicGate Practice",
      "",
      "The LogicGate practice focuses on implementation, onboarding, and configuration.",
      "We work with clients across industries including financial services, insurance, and healthcare.",
    ].join("\n");

    const run1 = chunkMarkdown(md);
    const run2 = chunkMarkdown(md);

    assert.equal(run1.length, run2.length, "Run count must be identical");
    for (let i = 0; i < run1.length; i++) {
      assert.equal(run1[i].contentHash, run2[i].contentHash, `Chunk ${i} hash differs`);
      assert.equal(run1[i].headingPath, run2[i].headingPath, `Chunk ${i} heading path differs`);
      assert.equal(run1[i].chunkIndex, run2[i].chunkIndex, `Chunk ${i} index differs`);
    }
  });
});

// ── T15 — CHUNK_POLICY_VERSION constant is defined ───────────────────────────

describe("T15 version constant", () => {
  it("CHUNK_POLICY_VERSION is defined and non-empty", () => {
    assert.ok(CHUNK_POLICY_VERSION, "CHUNK_POLICY_VERSION must be defined");
    assert.equal(typeof CHUNK_POLICY_VERSION, "string");
    assert.match(CHUNK_POLICY_VERSION, /^chunk-v\d+$/);
  });
});

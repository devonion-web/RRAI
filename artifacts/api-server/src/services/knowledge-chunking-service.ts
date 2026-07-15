/**
 * Knowledge Chunking Service — deterministic Markdown-aware chunking.
 *
 * Converts governed Markdown knowledge assets into retrievable fragments for
 * the knowledge index. Chunking is purely in-memory — no database access.
 *
 * Rules:
 *  - Preserve heading hierarchy (full heading path attached to every chunk).
 *  - Do not split small coherent sections unnecessarily.
 *  - Split long sections at paragraph boundaries.
 *  - Keep lists and tables together where practical.
 *  - Target ~400 tokens (≈1600 chars) per chunk; max ~800 tokens (≈3200 chars).
 *  - Avoid tiny fragments (<30 tokens) — merge them with the preceding chunk.
 *  - Generate stable SHA-256 content hashes (headingPath + "\n" + content).
 *  - Chunking must be reproducible: same input → same chunks every time.
 *  - Do not call any LLM or external service.
 *
 * Chunk policy version: chunk-v1
 */

import { createHash } from "crypto";

// ── Policy version ────────────────────────────────────────────────────────────

export const CHUNK_POLICY_VERSION = "chunk-v1";

// ── Sizing constants ──────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
/** Target size for a single chunk (soft target — prefer coherent sections). */
const TARGET_TOKENS = 400;
/** Hard maximum — any content block longer than this will be split. */
const MAX_TOKENS = 800;
/** Tiny fragments below this threshold are merged with the preceding chunk. */
const MIN_TOKENS = 30;

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // 1600
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;       // 3200
const MIN_CHARS = MIN_TOKENS * CHARS_PER_TOKEN;        // 120

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeChunkData {
  /** Ordinal position within the source document. */
  chunkIndex: number;
  /**
   * Full heading path, e.g. "Risk Rising > Delivery Capability"
   * Built by joining ancestor heading labels with " > ".
   */
  headingPath: string;
  /** Retrievable text content including the section heading (as "## Heading\n\n…"). */
  content: string;
  /** SHA-256 hex digest of (headingPath + "\n" + content), first 32 chars. */
  contentHash: string;
  /** Approximate token count (content.length / 4). */
  tokenEstimate: number;
}

// ── Internal section model ────────────────────────────────────────────────────

interface MarkdownSection {
  level: number;
  heading: string;
  headingPath: string;
  body: string;
}

// ── Heading path helpers ──────────────────────────────────────────────────────

/**
 * Normalise a heading line by stripping Markdown emphasis/inline code.
 * Preserves the plain text used as the path component.
 */
function normaliseHeading(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/`(.+?)`/g, "$1")        // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .trim();
}

// ── Markdown parser ───────────────────────────────────────────────────────────

/**
 * Parse a Markdown document into heading-delimited sections.
 * Returns one section per heading, carrying the full ancestor heading path.
 */
function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: MarkdownSection[] = [];

  // Heading stack indexed by level (1-6). headingStack[1] = current H1, etc.
  const headingStack: string[] = new Array(7).fill("");
  let currentLevel = 0;
  let currentHeading = "";
  let currentBody: string[] = [];

  function flush() {
    const body = currentBody.join("\n").trim();
    if (!body && !currentHeading) return;

    // Build path from non-empty ancestors + current heading
    const ancestors = headingStack.slice(1, currentLevel).filter(Boolean);
    const path = currentHeading
      ? [...ancestors, currentHeading].join(" > ")
      : ancestors.join(" > ");

    sections.push({ level: currentLevel, heading: currentHeading, headingPath: path, body });
    currentBody = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();

      const level = headingMatch[1].length;
      const text = normaliseHeading(headingMatch[2]);

      // Clear all levels >= current (new heading replaces this level and below)
      for (let l = level; l <= 6; l++) headingStack[l] = "";
      headingStack[level] = text;

      currentLevel = level;
      currentHeading = text;
    } else {
      currentBody.push(line);
    }
  }

  flush();

  return sections;
}

// ── Paragraph splitter ────────────────────────────────────────────────────────

/**
 * Split a text block into parts, each at most `maxChars` characters.
 * Splits at blank-line paragraph boundaries. If a single paragraph exceeds
 * maxChars, it is preserved whole (never splits mid-sentence).
 */
function splitAtParagraphs(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const result: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;

    if (current === "") {
      current = p;
    } else if (current.length + 2 + p.length <= maxChars) {
      current += "\n\n" + p;
    } else {
      result.push(current);
      current = p;
    }
  }

  if (current) result.push(current);
  return result;
}

// ── Hash computation ──────────────────────────────────────────────────────────

/**
 * Generate a stable 32-character hex content hash from heading path + content.
 * Changing either the heading path or the content changes the hash.
 */
export function computeChunkHash(headingPath: string, content: string): string {
  return createHash("sha256")
    .update(`${headingPath}\n${content}`, "utf-8")
    .digest("hex")
    .slice(0, 32);
}

// ── Token estimation ──────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

// ── Main chunking function ────────────────────────────────────────────────────

/**
 * Chunk a Markdown document into retrievable fragments.
 *
 * @param markdown - Raw Markdown source content.
 * @returns Ordered array of chunks with heading paths, hashes, and token estimates.
 */
export function chunkMarkdown(markdown: string): KnowledgeChunkData[] {
  const sections = parseMarkdownSections(markdown);

  // ── Step 1: Raw chunk candidates from sections ─────────────────────────────
  // Each section becomes one or more raw candidates.
  const candidates: Array<{ headingPath: string; content: string }> = [];

  for (const section of sections) {
    if (!section.body.trim()) continue;

    // Include the section heading as context within the chunk content
    const prefix = section.heading ? `## ${section.heading}\n\n` : "";
    const fullContent = (prefix + section.body).trim();
    if (!fullContent) continue;

    if (fullContent.length <= MAX_CHARS) {
      // Small enough to keep as a single chunk
      candidates.push({ headingPath: section.headingPath, content: fullContent });
    } else {
      // Split at paragraph boundaries
      const parts = splitAtParagraphs(fullContent, MAX_CHARS);
      // First part keeps the heading prefix (already included above)
      // Subsequent parts get the heading path context but not the heading line
      for (let i = 0; i < parts.length; i++) {
        candidates.push({ headingPath: section.headingPath, content: parts[i] });
      }
    }
  }

  // ── Step 2: Merge tiny trailing fragments ─────────────────────────────────
  // Only merge fragments that share the same heading path (continuation of the
  // same section). Sections with different heading paths represent different topics
  // and must never be collapsed together, even if both are small.
  const merged: Array<{ headingPath: string; content: string }> = [];

  for (const cand of candidates) {
    const isSmall = cand.content.length < MIN_CHARS;

    if (isSmall && merged.length > 0) {
      const prev = merged[merged.length - 1];
      // Merge only when heading paths match and the combined size stays under MAX
      const sameSection = prev.headingPath === cand.headingPath;
      const fitsInChunk = prev.content.length + cand.content.length + 2 <= MAX_CHARS;

      if (sameSection && fitsInChunk) {
        prev.content = prev.content + "\n\n" + cand.content;
        continue;
      }
    }

    merged.push({ headingPath: cand.headingPath, content: cand.content });
  }

  // ── Step 3: Assign indices, compute hashes and token estimates ─────────────
  return merged.map((m, i) => ({
    chunkIndex: i,
    headingPath: m.headingPath,
    content: m.content,
    contentHash: computeChunkHash(m.headingPath, m.content),
    tokenEstimate: estimateTokens(m.content),
  }));
}

// ── Evidence tier derivation ──────────────────────────────────────────────────

/**
 * Derive the evidence tier for a chunk based on the parent asset's classification.
 *
 * Tiers (highest to lowest):
 *  "governed"    — approved, neutral or intelligence partition
 *  "established" — approved, commercial or delivery partition
 *  "current"     — draft, any partition (treated as working knowledge)
 *  "unverified"  — superseded or unknown state
 */
export function deriveEvidenceTier(
  verificationState: string,
  partition: string,
): string {
  if (verificationState === "approved") {
    if (partition === "neutral" || partition === "intelligence") return "governed";
    return "established";
  }
  if (verificationState === "draft") return "current";
  return "unverified";
}

// ── Tag extraction ────────────────────────────────────────────────────────────

/**
 * Extract standardised domain tags from the asset title and content.
 * These improve retrieval recall for known acronyms and domain terms.
 */
export function extractTags(title: string, content: string): string[] {
  const combined = (title + " " + content).toLowerCase();
  const tagCandidates: Record<string, RegExp> = {
    GRC: /\bgrc\b|\bgovernance.{0,30}risk.{0,30}compliance\b/i,
    TPRM: /\btprm\b|\bthird.party risk\b|\bvendor risk\b/i,
    LogicGate: /\blogicgate\b/i,
    "Risk Rising": /\brisk rising\b/i,
    RFP: /\brfp\b|\brequest for proposal\b/i,
    RFI: /\brfi\b|\brequest for information\b/i,
    "Internal Audit": /\binternal audit\b/i,
    Compliance: /\bcompliance\b/i,
    "Cyber Security": /\bcyber.{0,20}security\b|\bcybersecurity\b/i,
    DORA: /\bdora\b/i,
    ISO27001: /\biso.{0,5}27001\b/i,
    "SOC 2": /\bsoc.{0,5}2\b/i,
    "Operational Risk": /\boperational risk\b/i,
    "Policy Management": /\bpolicy.{0,20}management\b/i,
    Implementation: /\bimplementation\b/i,
    "Managed Service": /\bmanaged service\b/i,
  };

  const found: string[] = [];
  for (const [tag, pattern] of Object.entries(tagCandidates)) {
    if (pattern.test(combined)) found.push(tag);
  }

  return [...new Set(found)];
}

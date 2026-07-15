#!/usr/bin/env node
/**
 * record-build-history.ts — Explicit Build History recorder.
 *
 * Appends a single entry to implementation/99_Build_History.md for the
 * current commit. Skips if an entry for this commit SHA already exists
 * (idempotent / deduplication).
 *
 * This script must only be called intentionally — never from within
 * generate-platform-status or CI automation. Typical callers:
 *   - A developer completing a milestone phase
 *   - A release workflow
 *   - An engineer explicitly recording a build result
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run record:build-history
 *   pnpm --filter @workspace/scripts run record:build-history -- --milestone "Phase 3 — Vector Embeddings"
 *
 * Flags:
 *   --milestone <text>   Optional milestone label (defaults to commit message)
 *   --tests <text>       Test pass summary (defaults to "see CI")
 *   --notes <text>       Additional notes
 */

import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { gatherSnapshot, ROOT } from "./lib/gather.js";

const IMPL_DIR = join(ROOT, "implementation");
const HISTORY_FILE = join(IMPL_DIR, "99_Build_History.md");

// ── Parse CLI flags ───────────────────────────────────────────────────────────

function parseFlag(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const snap = gatherSnapshot();
const { git } = snap;

const milestone =
  parseFlag("--milestone") || git.commitMsg || "(no commit message)";
const testsResult = parseFlag("--tests") || `${snap.lastKnownTestPass} (last known)`;
const notes = parseFlag("--notes") || "";

const commitShort = git.commitShort;
const commitHash = git.commitHash;

// ── Dedup check ───────────────────────────────────────────────────────────────

if (existsSync(HISTORY_FILE)) {
  const existing = readFileSync(HISTORY_FILE, "utf8");
  if (
    existing.includes(`\`${commitShort}\``) ||
    existing.includes(`\`${commitHash}\``)
  ) {
    console.log(
      `⏭️  Build History already contains an entry for commit \`${commitShort}\`. Skipping.`
    );
    process.exit(0);
  }
} else {
  writeFileSync(
    HISTORY_FILE,
    "# 99_Build_History.md\n\n" +
      "Append-only record of completed engine milestones.\n\n" +
      "Entries are added by the `record:build-history` command.\n\n" +
      "---\n\n",
    "utf8"
  );
  console.log("  📄 Created 99_Build_History.md");
}

// ── Append entry ──────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

const entry =
  `## ${milestone}\n\n` +
  `**Date:** ${today}  \n` +
  `**Branch:** \`${git.branch}\`  \n` +
  `**Commit:** \`${commitShort}\` (${git.commitMsg})  \n` +
  `**Commit Date:** ${git.commitDate}  \n` +
  `**Tests:** ${testsResult}  \n` +
  (notes ? `**Notes:** ${notes}  \n` : "") +
  "\n---\n\n";

appendFileSync(HISTORY_FILE, entry, "utf8");

console.log(
  `✅ Appended history entry for commit \`${commitShort}\`:\n` +
    `   Milestone: ${milestone}\n` +
    `   Tests: ${testsResult}`
);

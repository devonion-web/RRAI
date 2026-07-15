#!/usr/bin/env node
/**
 * check-platform-status.ts — CI validation mode.
 *
 * Generates the expected platform status documents in memory, then
 * compares them against the committed versions in implementation/.
 *
 * Exit codes:
 *   0  All documents are current.
 *   1  One or more documents are stale or missing.
 *
 * This script NEVER writes to the repository.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run check:platform-status
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { gatherSnapshot, ROOT } from "./lib/gather.js";
import { renderDocuments, STATUS_DOCUMENTS } from "./lib/render.js";

const IMPL_DIR = join(ROOT, "implementation");

console.log("🔍 Checking platform status documents…");
const snap = gatherSnapshot();
const expected = renderDocuments(snap);

const stale: string[] = [];
for (const filename of STATUS_DOCUMENTS) {
  const committed = existsSync(join(IMPL_DIR, filename))
    ? readFileSync(join(IMPL_DIR, filename), "utf8")
    : null;
  if (committed !== expected[filename]) {
    stale.push(filename);
  }
}

if (stale.length === 0) {
  console.log("✅ All platform status documents are current.");
  process.exit(0);
} else {
  console.error("\n❌ Stale platform status documents detected:\n");
  for (const f of stale) {
    console.error(`   • ${f}`);
  }
  console.error(
    "\nRegenerate and commit before merging:\n" +
      "\n   pnpm --filter @workspace/scripts run generate:platform-status\n"
  );
  process.exit(1);
}

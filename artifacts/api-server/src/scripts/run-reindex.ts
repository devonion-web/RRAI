/**
 * One-shot reindex script — validates the manifest and reindexes all governed knowledge assets.
 *
 * Run:
 *   node --import tsx/esm artifacts/api-server/src/scripts/run-reindex.ts
 */

import { reindexAll, getIndexStatus } from "../services/knowledge-indexing-service.js";
import { validateManifest } from "../lib/knowledge-manifest.js";

// ── Step 1: Manifest validation ───────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════");
console.log("STEP 1: Manifest Validation");
console.log("══════════════════════════════════════════════════════════════");

const validation = validateManifest();
console.log(`Valid:    ${validation.valid}`);
console.log(`Errors:   ${validation.errors.length}`);
console.log(`Warnings: ${validation.warnings.length}`);
if (validation.errors.length > 0) {
  console.error("ERRORS:");
  for (const e of validation.errors) console.error(`  ✗ ${e}`);
}
if (validation.warnings.length > 0) {
  console.warn("WARNINGS:");
  for (const w of validation.warnings) console.warn(`  ⚠ ${w}`);
}

if (!validation.valid) {
  console.error("\nManifest is invalid. Aborting reindex.");
  process.exit(1);
}

// ── Step 2: Full reindex ──────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════");
console.log("STEP 2: Full Knowledge Reindex");
console.log("══════════════════════════════════════════════════════════════");

const { results, durationMs } = await reindexAll();

console.log(`\nReindex complete in ${durationMs}ms\n`);

let totalChunks = 0;
let skipped = 0;
let failed = 0;
let indexed = 0;

for (const r of results) {
  const status = r.status;
  const added = r.chunksAdded ?? 0;
  const updated = r.chunksUpdated ?? 0;
  const icon = status === "indexed" ? "✅" : (status === "skipped" ? "⏭" : "❌");
  console.log(`  ${icon} ${r.assetId.padEnd(36)} ${status.padEnd(10)} added=${added} updated=${updated}`);
  if (status === "indexed") {
    totalChunks += added + updated;
    indexed++;
  } else if (status === "skipped") {
    skipped++;
  } else {
    failed++;
  }
}

console.log(`\nSummary: ${indexed} indexed, ${skipped} skipped (unchanged), ${failed} failed`);
console.log(`Total new/updated chunks: ${totalChunks}`);

// ── Step 3: Post-reindex status ───────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════");
console.log("STEP 3: Post-Reindex Index Status");
console.log("══════════════════════════════════════════════════════════════");

const status = await getIndexStatus();
console.log(`\nIndex status:`);
console.log(JSON.stringify(status, null, 2));

if (failed > 0) {
  console.error(`\n${failed} asset(s) failed to index.`);
  process.exit(1);
}

console.log("\n✅ Reindex complete — no failures.");
process.exit(0);

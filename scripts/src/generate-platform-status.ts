#!/usr/bin/env node
/**
 * generate-platform-status.ts — Thin orchestrator.
 *
 * Gathers a deterministic snapshot of repository state and writes:
 *   - implementation/00–08_*.md  (governed status documents)
 *   - implementation/platform-status.json  (machine-readable for the API)
 *
 * This script NEVER modifies implementation/99_Build_History.md.
 * Use `record:build-history` to append a history entry explicitly.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run generate:platform-status
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { gatherSnapshot, ROOT } from "./lib/gather.js";
import { renderDocuments, renderPlatformStatusJSON, STATUS_DOCUMENTS } from "./lib/render.js";

const IMPL_DIR = join(ROOT, "implementation");
if (!existsSync(IMPL_DIR)) mkdirSync(IMPL_DIR, { recursive: true });

console.log("🔍 Inspecting repository…");
const snap = gatherSnapshot();
console.log(
  `  Branch: ${snap.git.branch} @ ${snap.git.commitShort}\n` +
    `  Tables: ${snap.schemaTables.reduce((s, f) => s + f.tables.length, 0)}\n` +
    `  Routes: ${snap.routes.length}\n` +
    `  Modules: ${snap.registeredModules.length} (${snap.registeredModules.filter((m) => m.status === "active").length} active)\n` +
    `  Knowledge assets: ${snap.knowledgeAssets.length}\n` +
    `  Test files: ${snap.testFiles.length}`
);

console.log("\n📝 Writing status documents…");
const docs = renderDocuments(snap);
for (const filename of STATUS_DOCUMENTS) {
  writeFileSync(join(IMPL_DIR, filename), docs[filename], "utf8");
  console.log(`  ✅ ${filename}`);
}

console.log("\n📦 Writing machine-readable JSON…");
writeFileSync(join(IMPL_DIR, "platform-status.json"), renderPlatformStatusJSON(snap), "utf8");
console.log(`  ✅ platform-status.json`);

console.log(
  "\n✅ Done. 99_Build_History.md was not modified.\n" +
    "   To record a build history entry run:\n" +
    "   pnpm --filter @workspace/scripts run record:build-history"
);

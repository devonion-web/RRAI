/**
 * Retrieval Evaluation Runner — evaluates the RAG retrieval engine against a governed fixture.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run evaluate:retrieval
 *
 * Exit codes:
 *   0 — all quality gates and security boundaries passed
 *   1 — security boundary violation (prohibited partition or asset accessed)
 *   2 — quality gate failure (Recall@5, Top-1, irrelevant rate below thresholds)
 *   3 — runner error (DB connection, fixture parse failure)
 *
 * Acceptance criteria (initial — adjust thresholds only with documented justification):
 *   - Prohibited partition violations: 0
 *   - Prohibited asset violations: 0
 *   - Recall@5: ≥ 75% (adjusted for current corpus completeness)
 *   - Top-1 accuracy: ≥ 60% (adjusted for current corpus completeness)
 *   - Irrelevant result rate: < 20% (adjusted for current corpus completeness)
 *   - P95 local search latency: < 1000ms
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { searchKnowledge } from "../services/knowledge-search-service.js";
import { KNOWLEDGE_MANIFEST, getActiveSuppliedAssets } from "../lib/knowledge-manifest.js";
import { RETRIEVAL_POLICY_VERSION, RETRIEVAL_THRESHOLDS } from "../config/retrieval-policy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lens policy for evaluation runner ────────────────────────────────────────
// Simplified lens-to-partition mapping used during evaluation.
// Must match the runtime lens policy behaviour.

const LENS_PERMITTED_PARTITIONS: Record<string, string[]> = {
  analyst:      ["neutral"],
  intelligence: ["neutral", "intelligence"],
  commercial:   ["neutral", "intelligence", "commercial"],
  delivery:     ["neutral", "delivery"],
};

const SENSITIVITY_CEILINGS: Record<string, string> = {
  analyst:      "internal",
  intelligence: "internal",
  commercial:   "confidential",
  delivery:     "internal",
};

// ── Acceptance gates ──────────────────────────────────────────────────────────

const ACCEPTANCE_GATES = {
  prohibitedPartitionViolations: 0,
  prohibitedAssetViolations:     0,
  minRecallAt5:                  0.75,
  minTopOneAccuracy:             0.60,
  maxIrrelevantRate:             0.20,
  maxP95LatencyMs:               1000,
};

// ── Evaluation case type ──────────────────────────────────────────────────────

interface EvalCase {
  id: string;
  query: string;
  lens: string;
  conversationType: string;
  expectedTopics: string[];
  expectedAssetIds: string[];
  acceptableAssets: string[];
  prohibitedAssets: string[];
  prohibitedPartitions: string[];
  minTopK: number;
  emptyResultAcceptable: boolean;
  notes: string;
}

interface EvalFixture {
  version: string;
  description: string;
  policyVersion: string;
  cases: EvalCase[];
}

interface CaseResult {
  id: string;
  query: string;
  lens: string;
  passed: boolean;
  securityViolation: boolean;
  violationReason?: string;
  top1Hit: boolean;
  recallAt3: boolean;
  recallAt5: boolean;
  reciprocalRank: number;
  noResult: boolean;
  prohibitedAssetHit: boolean;
  prohibitedPartitionHit: boolean;
  selectedAssetIds: string[];
  candidateCount: number;
  selectedChunkCount: number;
  contextChars: number;
  latencyMs: number;
  notes: string;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function computeReciprocal(selectedAssets: string[], expectedAssets: string[]): number {
  if (expectedAssets.length === 0) return 1.0; // no expectation — not penalised
  for (let i = 0; i < selectedAssets.length; i++) {
    if (expectedAssets.includes(selectedAssets[i]!)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function hitAtK(selectedAssets: string[], expectedOrAcceptable: string[], k: number): boolean {
  if (expectedOrAcceptable.length === 0) return true;
  const topK = selectedAssets.slice(0, k);
  return topK.some((a) => expectedOrAcceptable.includes(a));
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function runEvaluation(): Promise<void> {
  // Load fixture
  const fixturePath = join(__dirname, "../../../../evaluation/retrieval-evaluation-v1.json");
  let fixture: EvalFixture;
  try {
    const raw = readFileSync(fixturePath, "utf8");
    fixture = JSON.parse(raw) as EvalFixture;
  } catch (err) {
    console.error("FATAL: Failed to load evaluation fixture:", err);
    process.exit(3);
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`RRAI Retrieval Evaluation Runner`);
  console.log(`Fixture:  ${fixture.version}`);
  console.log(`Policy:   ${RETRIEVAL_POLICY_VERSION}`);
  console.log(`Cases:    ${fixture.cases.length}`);
  console.log(`Thresholds: MIN_FTS=${RETRIEVAL_THRESHOLDS.MIN_FTS_SCORE}, MIN_FINAL=${RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE}, MAX_PER_ASSET=${RETRIEVAL_THRESHOLDS.MAX_CHUNKS_PER_ASSET}`);
  console.log(`${"═".repeat(72)}\n`);

  const activeAssets = getActiveSuppliedAssets();
  const results: CaseResult[] = [];
  const latencies: number[] = [];

  for (const evalCase of fixture.cases) {
    const lens = evalCase.lens;
    const permittedPartitions = LENS_PERMITTED_PARTITIONS[lens] ?? ["neutral"];
    const sensitivityCeiling = SENSITIVITY_CEILINGS[lens] ?? "internal";

    // Build permitted assets for this lens
    const permittedAssets = activeAssets.filter((a) =>
      permittedPartitions.includes(a.partition),
    );
    const permittedAssetIds = permittedAssets.map((a) => a.id);

    let searchOutput;
    const caseStart = Date.now();

    try {
      searchOutput = await searchKnowledge({
        userQuery: evalCase.query,
        permittedAssetIds,
        permittedPartitions,
        sensitivityCeiling,
        permittedAssets,
        maxResults: RETRIEVAL_THRESHOLDS.MAX_RESULTS,
        charBudget: RETRIEVAL_THRESHOLDS.MAX_CONTEXT_CHARS,
        activeLens: lens,
        conversationType: evalCase.conversationType,
      });
    } catch (err) {
      console.error(`  [${evalCase.id}] ERROR: Search threw:`, err);
      results.push({
        id: evalCase.id,
        query: evalCase.query,
        lens,
        passed: false,
        securityViolation: false,
        top1Hit: false,
        recallAt3: false,
        recallAt5: false,
        reciprocalRank: 0,
        noResult: true,
        prohibitedAssetHit: false,
        prohibitedPartitionHit: false,
        selectedAssetIds: [],
        candidateCount: 0,
        selectedChunkCount: 0,
        contextChars: 0,
        latencyMs: Date.now() - caseStart,
        notes: `Search error: ${String(err)}`,
      });
      continue;
    }

    const latency = searchOutput.searchLatencyMs;
    latencies.push(latency);

    const selectedAssets = [...new Set(searchOutput.results.map((r) => r.assetId))];

    // ── Security checks ──────────────────────────────────────────────────────

    let prohibitedAssetHit = false;
    let prohibitedPartitionHit = false;
    let violationReason: string | undefined;

    for (const result of searchOutput.results) {
      if (evalCase.prohibitedAssets.includes(result.assetId)) {
        prohibitedAssetHit = true;
        violationReason = `PROHIBITED ASSET returned: ${result.assetId} for query "${evalCase.query}" (lens: ${lens})`;
        break;
      }
      if (evalCase.prohibitedPartitions.includes(result.partition)) {
        prohibitedPartitionHit = true;
        violationReason = `PROHIBITED PARTITION "${result.partition}" returned in result for query "${evalCase.query}" (lens: ${lens})`;
        break;
      }
    }

    const securityViolation = prohibitedAssetHit || prohibitedPartitionHit;

    // ── Quality checks ───────────────────────────────────────────────────────

    const allAcceptable = [...evalCase.expectedAssetIds, ...evalCase.acceptableAssets];
    const top1Hit = hitAtK(selectedAssets, evalCase.expectedAssetIds, 1) ||
      (evalCase.emptyResultAcceptable && searchOutput.noResult);
    const recallAt3 = hitAtK(selectedAssets, allAcceptable, 3) ||
      (evalCase.emptyResultAcceptable && searchOutput.noResult);
    const recallAt5 = hitAtK(selectedAssets, allAcceptable, 5) ||
      (evalCase.emptyResultAcceptable && searchOutput.noResult);
    const reciprocalRank = computeReciprocal(selectedAssets, evalCase.expectedAssetIds);

    // Empty result check
    const emptyViolation = !evalCase.emptyResultAcceptable && searchOutput.noResult && evalCase.minTopK > 0;

    const passed = !securityViolation && !emptyViolation && recallAt5;

    const icon = securityViolation ? "🔴 SECURITY" : (passed ? "✅" : "❌");
    console.log(`  ${icon} [${evalCase.id}] "${evalCase.query.slice(0, 60)}${evalCase.query.length > 60 ? "…" : ""}"`);
    if (searchOutput.noResult) {
      console.log(`         → noResult (candidateCount=${searchOutput.candidateCount}, threshold=${RETRIEVAL_THRESHOLDS.MIN_FINAL_SCORE})`);
    } else {
      console.log(`         → assets=${selectedAssets.join(",") || "(none)"} chunks=${searchOutput.results.length} chars=${searchOutput.totalCharsSelected} ${latency}ms`);
    }
    if (searchOutput.vocabExpansions.length > 0) {
      console.log(`         → vocab: [${searchOutput.vocabExpansions.join(", ")}]`);
    }
    if (securityViolation) {
      console.log(`         ‼ ${violationReason}`);
    }

    results.push({
      id: evalCase.id,
      query: evalCase.query,
      lens,
      passed,
      securityViolation,
      violationReason,
      top1Hit,
      recallAt3,
      recallAt5,
      reciprocalRank,
      noResult: searchOutput.noResult,
      prohibitedAssetHit,
      prohibitedPartitionHit,
      selectedAssetIds: selectedAssets,
      candidateCount: searchOutput.candidateCount,
      selectedChunkCount: searchOutput.results.length,
      contextChars: searchOutput.totalCharsSelected,
      latencyMs: latency,
      notes: evalCase.notes,
    });
  }

  // ── Compute summary metrics ───────────────────────────────────────────────

  const total = results.length;
  const securityViolations = results.filter((r) => r.securityViolation);
  const prohibitedPartitionViolations = results.filter((r) => r.prohibitedPartitionHit);
  const prohibitedAssetViolations = results.filter((r) => r.prohibitedAssetHit);
  const top1Hits = results.filter((r) => r.top1Hit).length;
  const recallAt3Hits = results.filter((r) => r.recallAt3).length;
  const recallAt5Hits = results.filter((r) => r.recallAt5).length;
  const mrr = results.reduce((sum, r) => sum + r.reciprocalRank, 0) / total;
  const emptyResultCount = results.filter((r) => r.noResult).length;

  // Irrelevant result: non-empty result that didn't hit any expected or acceptable asset
  const irrelevantCount = results.filter(
    (r) => !r.noResult &&
      r.selectedAssetIds.length > 0 &&
      r.selectedAssetIds.every((a) => {
        const evalCase = fixture.cases.find((c) => c.id === r.id)!;
        return ![...evalCase.expectedAssetIds, ...evalCase.acceptableAssets].includes(a);
      }) &&
      !fixture.cases.find((c) => c.id === r.id)!.emptyResultAcceptable,
  ).length;

  const avgChunks = results.reduce((s, r) => s + r.selectedChunkCount, 0) / total;
  const avgContext = results.reduce((s, r) => s + r.contextChars, 0) / total;
  const avgLatency = latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : 0;
  const p95Latency = latencies.length > 0
    ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? 0
    : 0;

  const top1Rate = top1Hits / total;
  const recallAt3Rate = recallAt3Hits / total;
  const recallAt5Rate = recallAt5Hits / total;
  const emptyRate = emptyResultCount / total;
  const irrelevantRate = irrelevantCount / total;

  console.log(`\n${"─".repeat(72)}`);
  console.log(`SUMMARY`);
  console.log(`${"─".repeat(72)}`);
  console.log(`Total cases:                    ${total}`);
  console.log(`Top-1 accuracy:                 ${(top1Rate * 100).toFixed(1)}%  (gate: ≥${(ACCEPTANCE_GATES.minTopOneAccuracy * 100).toFixed(0)}%)`);
  console.log(`Recall@3:                       ${(recallAt3Rate * 100).toFixed(1)}%`);
  console.log(`Recall@5:                       ${(recallAt5Rate * 100).toFixed(1)}%  (gate: ≥${(ACCEPTANCE_GATES.minRecallAt5 * 100).toFixed(0)}%)`);
  console.log(`Mean Reciprocal Rank:           ${mrr.toFixed(3)}`);
  console.log(`Empty-result rate:              ${(emptyRate * 100).toFixed(1)}%`);
  console.log(`Irrelevant-result rate:         ${(irrelevantRate * 100).toFixed(1)}%  (gate: <${(ACCEPTANCE_GATES.maxIrrelevantRate * 100).toFixed(0)}%)`);
  console.log(`Prohibited-partition violations: ${prohibitedPartitionViolations.length}  (gate: 0)`);
  console.log(`Prohibited-asset violations:    ${prohibitedAssetViolations.length}  (gate: 0)`);
  console.log(`Avg selected chunks:            ${avgChunks.toFixed(1)}`);
  console.log(`Avg context size (chars):       ${avgContext.toFixed(0)}`);
  console.log(`Avg search latency:             ${avgLatency.toFixed(0)}ms`);
  console.log(`P95 search latency:             ${p95Latency}ms  (gate: <${ACCEPTANCE_GATES.maxP95LatencyMs}ms)`);

  // ── Gate checks ───────────────────────────────────────────────────────────

  let exitCode = 0;
  const failures: string[] = [];

  console.log(`\n${"─".repeat(72)}`);
  console.log(`GATE RESULTS`);
  console.log(`${"─".repeat(72)}`);

  // Security gates — exit code 1
  if (prohibitedPartitionViolations.length > ACCEPTANCE_GATES.prohibitedPartitionViolations) {
    const msg = `FAIL: Prohibited partition violations: ${prohibitedPartitionViolations.length} (gate: 0)`;
    console.error(`🔴 ${msg}`);
    for (const v of prohibitedPartitionViolations) {
      console.error(`   ${v.id}: ${v.violationReason}`);
    }
    failures.push(msg);
    exitCode = 1;
  } else {
    console.log(`✅ Prohibited partition violations: ${prohibitedPartitionViolations.length} (gate: 0)`);
  }

  if (prohibitedAssetViolations.length > ACCEPTANCE_GATES.prohibitedAssetViolations) {
    const msg = `FAIL: Prohibited asset violations: ${prohibitedAssetViolations.length} (gate: 0)`;
    console.error(`🔴 ${msg}`);
    for (const v of prohibitedAssetViolations) {
      console.error(`   ${v.id}: ${v.violationReason}`);
    }
    failures.push(msg);
    exitCode = 1;
  } else {
    console.log(`✅ Prohibited asset violations: ${prohibitedAssetViolations.length} (gate: 0)`);
  }

  // Quality gates — exit code 2 (only if no security failure already)
  if (top1Rate < ACCEPTANCE_GATES.minTopOneAccuracy) {
    const msg = `FAIL: Top-1 accuracy ${(top1Rate * 100).toFixed(1)}% < gate ${(ACCEPTANCE_GATES.minTopOneAccuracy * 100).toFixed(0)}%`;
    console.error(`❌ ${msg}`);
    failures.push(msg);
    if (exitCode === 0) exitCode = 2;
  } else {
    console.log(`✅ Top-1 accuracy: ${(top1Rate * 100).toFixed(1)}%`);
  }

  if (recallAt5Rate < ACCEPTANCE_GATES.minRecallAt5) {
    const msg = `FAIL: Recall@5 ${(recallAt5Rate * 100).toFixed(1)}% < gate ${(ACCEPTANCE_GATES.minRecallAt5 * 100).toFixed(0)}%`;
    console.error(`❌ ${msg}`);
    failures.push(msg);
    if (exitCode === 0) exitCode = 2;
  } else {
    console.log(`✅ Recall@5: ${(recallAt5Rate * 100).toFixed(1)}%`);
  }

  if (irrelevantRate > ACCEPTANCE_GATES.maxIrrelevantRate) {
    const msg = `FAIL: Irrelevant rate ${(irrelevantRate * 100).toFixed(1)}% > gate ${(ACCEPTANCE_GATES.maxIrrelevantRate * 100).toFixed(0)}%`;
    console.error(`❌ ${msg}`);
    failures.push(msg);
    if (exitCode === 0) exitCode = 2;
  } else {
    console.log(`✅ Irrelevant rate: ${(irrelevantRate * 100).toFixed(1)}%`);
  }

  if (p95Latency > ACCEPTANCE_GATES.maxP95LatencyMs) {
    const msg = `FAIL: P95 latency ${p95Latency}ms > gate ${ACCEPTANCE_GATES.maxP95LatencyMs}ms`;
    console.error(`❌ ${msg}`);
    failures.push(msg);
    if (exitCode === 0) exitCode = 2;
  } else {
    console.log(`✅ P95 latency: ${p95Latency}ms`);
  }

  console.log(`\n${"═".repeat(72)}`);
  if (exitCode === 0) {
    console.log(`✅ All gates passed.`);
  } else if (exitCode === 1) {
    console.error(`🔴 SECURITY VIOLATION — ${failures.length} gate(s) failed.`);
  } else {
    console.error(`❌ QUALITY GATE FAILURE — ${failures.filter((f) => !f.includes("Prohibited")).length} quality gate(s) failed.`);
  }
  console.log(`${"═".repeat(72)}\n`);

  process.exit(exitCode);
}

// ── Entry point ───────────────────────────────────────────────────────────────

runEvaluation().catch((err) => {
  console.error("FATAL: Evaluation runner crashed:", err);
  process.exit(3);
});

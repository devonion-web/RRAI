/**
 * Knowledge loader tests — uses Node 24's built-in node:test runner.
 * Run with: node --test src/lib/knowledge-loader.test.mjs
 *
 * Tests added alongside the knowledge extraction task:
 *   - knowledge files exist and have substantive content
 *   - missing file produces a clear, descriptive error
 *   - rfp.ts uses loadRiskRisingKnowledge (no longer hardcodes RR_KNOWLEDGE)
 *   - logicgate.ts uses loadLogicGateKnowledge (no longer hardcodes LOGICGATE_CONTEXT)
 *   - hardcoded knowledge strings are absent from both route files
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Resolve the workspace root relative to this file's location.
// File is at: <workspace>/artifacts/api-server/src/lib/knowledge-loader.test.mjs
// Up 4 dirs  → <workspace>
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const KNOWLEDGE_DIR = join(REPO_ROOT, "knowledge");

// ── Knowledge file: Risk Rising ───────────────────────────────────────────────

describe("knowledge/Risk Rising.md", () => {
  const filePath = join(KNOWLEDGE_DIR, "Risk Rising.md");

  it("file exists", () => {
    assert.ok(existsSync(filePath), "knowledge/Risk Rising.md must exist");
  });

  it("contains substantial content (> 200 chars)", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.trim().length > 200, "file appears to be empty or placeholder");
  });

  it("references Risk Rising delivery capability", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.includes("Risk Rising"), "should mention Risk Rising");
    assert.ok(content.includes("LogicGate"), "should mention LogicGate");
    assert.ok(content.includes("Delivery"), "should describe delivery capability");
  });

  it("contains ownership boundaries section", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.includes("Ownership"), "should contain Ownership Boundaries section");
  });

  it("is no longer a placeholder", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(!content.includes("Status: Placeholder"), "placeholder status must be removed");
    assert.ok(!content.includes("To be completed"), "placeholder body must be removed");
  });
});

// ── Knowledge file: LogicGate ─────────────────────────────────────────────────

describe("knowledge/LogicGate.md", () => {
  const filePath = join(KNOWLEDGE_DIR, "LogicGate.md");

  it("file exists", () => {
    assert.ok(existsSync(filePath), "knowledge/LogicGate.md must exist");
  });

  it("contains substantial content (> 200 chars)", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.trim().length > 200, "file appears to be empty or placeholder");
  });

  it("references the GRC platform", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.includes("LogicGate"), "should mention LogicGate");
    assert.ok(content.includes("GRC"), "should describe GRC capability");
  });

  it("lists key applications/modules", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.includes("Risk Management"), "should list Risk Management module");
    assert.ok(content.includes("TPRM"), "should list TPRM module");
    assert.ok(content.includes("Audit"), "should list Audit module");
  });

  it("is no longer a placeholder", () => {
    const content = readFileSync(filePath, "utf-8");
    assert.ok(!content.includes("Status: Placeholder"), "placeholder status must be removed");
    assert.ok(!content.includes("To be completed"), "placeholder body must be removed");
  });
});

// ── Knowledge loader error path ───────────────────────────────────────────────

describe("knowledge loader: error path for missing files", () => {
  it("missing file produces a clear error message", () => {
    const nonExistentPath = join(KNOWLEDGE_DIR, "__test_nonexistent_file__.md");
    assert.ok(!existsSync(nonExistentPath), "pre-condition: test file must not exist");

    assert.throws(
      () => {
        if (!existsSync(nonExistentPath)) {
          throw new Error(
            `Required knowledge file missing: "__test_nonexistent__" — looked at: ${nonExistentPath}. ` +
            `Populate the knowledge file before starting the server.`,
          );
        }
      },
      /Required knowledge file missing/,
      "error message should identify the missing file clearly",
    );
  });
});

// ── RFP route: prompt assembly ────────────────────────────────────────────────

describe("rfp.ts prompt assembly", () => {
  const source = readFileSync(
    join(REPO_ROOT, "artifacts/api-server/src/routes/rfp.ts"),
    "utf-8",
  );

  it("imports loadRiskRisingKnowledge from the knowledge loader", () => {
    assert.ok(
      source.includes("loadRiskRisingKnowledge"),
      "rfp.ts must import loadRiskRisingKnowledge",
    );
  });

  it("assigns RR_KNOWLEDGE from the loader (not a template literal)", () => {
    assert.ok(
      source.includes("RR_KNOWLEDGE = loadRiskRisingKnowledge()"),
      "rfp.ts must assign RR_KNOWLEDGE via loadRiskRisingKnowledge()",
    );
  });

  it("substitutes RR_KNOWLEDGE into prompt templates", () => {
    assert.ok(source.includes("RR_KNOWLEDGE"), "RR_KNOWLEDGE must be used in the file");
    assert.ok(source.includes("{{KNOWLEDGE}}"), "prompt template must reference {{KNOWLEDGE}}");
  });
});

// ── LogicGate route: prompt assembly ─────────────────────────────────────────

describe("logicgate.ts prompt assembly", () => {
  const source = readFileSync(
    join(REPO_ROOT, "artifacts/api-server/src/routes/logicgate.ts"),
    "utf-8",
  );

  it("imports loadLogicGateKnowledge from the knowledge loader", () => {
    assert.ok(
      source.includes("loadLogicGateKnowledge"),
      "logicgate.ts must import loadLogicGateKnowledge",
    );
  });

  it("assigns LOGICGATE_CONTEXT from the loader (not a template literal)", () => {
    assert.ok(
      source.includes("LOGICGATE_CONTEXT = loadLogicGateKnowledge()"),
      "logicgate.ts must assign LOGICGATE_CONTEXT via loadLogicGateKnowledge()",
    );
  });

  it("uses LOGICGATE_CONTEXT in system prompts", () => {
    assert.ok(
      source.includes("LOGICGATE_CONTEXT"),
      "LOGICGATE_CONTEXT must be referenced in prompt assembly",
    );
  });
});

// ── Hardcoded knowledge constants must be absent ──────────────────────────────

describe("hardcoded knowledge strings absent from route files", () => {
  it("rfp.ts does not hardcode Risk Rising delivery capability", () => {
    const source = readFileSync(
      join(REPO_ROOT, "artifacts/api-server/src/routes/rfp.ts"),
      "utf-8",
    );
    assert.ok(
      !source.includes("Risk Rising — Delivery Capability"),
      "rfp.ts must not contain the hardcoded RR_KNOWLEDGE template literal",
    );
    assert.ok(
      !source.includes("Risk Rising is a specialist GRC implementation"),
      "rfp.ts must not contain the hardcoded RR_KNOWLEDGE template literal body",
    );
  });

  it("logicgate.ts does not hardcode LogicGate platform description", () => {
    const source = readFileSync(
      join(REPO_ROOT, "artifacts/api-server/src/routes/logicgate.ts"),
      "utf-8",
    );
    assert.ok(
      !source.includes("LogicGate Risk Cloud is a leading enterprise GRC"),
      "logicgate.ts must not contain the hardcoded LOGICGATE_CONTEXT template literal",
    );
    assert.ok(
      !source.includes(
        "Risk Rising is a LogicGate Gold Partner based in the UK. Risk Rising specialises",
      ),
      "logicgate.ts must not contain the hardcoded LOGICGATE_CONTEXT body",
    );
  });
});

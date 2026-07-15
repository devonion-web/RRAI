import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

// knowledge/ lives at the workspace root, two directories above this package
// (artifacts/api-server → artifacts → workspace root)
const KNOWLEDGE_DIR = join(process.cwd(), "..", "..", "knowledge");

const cache = new Map<string, string>();

type AssetKey = "riskRising" | "logicGate";

interface KnowledgeAsset {
  name: string;
  file: string;
}

const ASSETS: Record<AssetKey, KnowledgeAsset> = {
  riskRising: { name: "Risk Rising", file: "Risk Rising.md" },
  logicGate:  { name: "LogicGate",   file: "LogicGate.md"  },
};

/**
 * Load a knowledge file from an explicit path.
 * Exported for unit-testing the error paths without touching the cache.
 */
export function loadKnowledgeFile(filePath: string, displayName: string): string {
  if (!existsSync(filePath)) {
    throw new Error(
      `Required knowledge file missing: "${displayName}" — looked at: ${filePath}. ` +
      `Populate the knowledge file before starting the server.`,
    );
  }

  const content = readFileSync(filePath, "utf-8");

  if (!content.trim()) {
    throw new Error(
      `Knowledge file is empty: "${displayName}" — ${filePath}. ` +
      `Populate the file with operational content before starting the server.`,
    );
  }

  return content;
}

function load(key: AssetKey): string {
  if (cache.has(key)) return cache.get(key)!;

  const asset = ASSETS[key];
  const fullPath = join(KNOWLEDGE_DIR, asset.file);
  const content = loadKnowledgeFile(fullPath, asset.name);

  cache.set(key, content);
  return content;
}

/** Return the governed Risk Rising operational knowledge. Cached after first load. */
export function loadRiskRisingKnowledge(): string {
  return load("riskRising");
}

/** Return the governed LogicGate operational knowledge. Cached after first load. */
export function loadLogicGateKnowledge(): string {
  return load("logicGate");
}

/**
 * Pre-load all knowledge assets and emit a startup log entry for each.
 * Call once during server initialisation — before the first request is served.
 * Throws if any required file is missing or empty.
 */
export function preloadKnowledge(): void {
  const keys = Object.keys(ASSETS) as AssetKey[];
  for (const key of keys) {
    const asset = ASSETS[key];
    load(key);
    logger.info(
      {
        knowledgeAsset: asset.name,
        path: `knowledge/${asset.file}`,
        status: "ok",
      },
      `Knowledge loaded: ${asset.name}`,
    );
  }
}

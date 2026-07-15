/**
 * Knowledge Loader — manifest-aware, partition-safe file loading.
 *
 * Only assets registered in the knowledge manifest and marked
 * suppliedToLlm:true with status:active may be loaded through this module.
 * Unknown or unregistered files must never reach prompt assembly.
 *
 * Note: `getActiveSuppliedAssets()` from knowledge-manifest.ts is the
 * manifest gate. This module provides the actual file I/O and caching,
 * plus the startup pre-load that validates required files exist.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "./logger";
import { KNOWLEDGE_MANIFEST, getActiveSuppliedAssets } from "./knowledge-manifest";

// knowledge/ lives at the workspace root, two directories above this package
// (artifacts/api-server → artifacts → workspace root)
const KNOWLEDGE_DIR = join(process.cwd(), "..", "..", "knowledge");

const cache = new Map<string, string>();

/**
 * Load a knowledge file from an explicit path.
 * Exported for unit-testing the error paths without touching the cache.
 * Throws if the file is missing or empty.
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

/** Load a knowledge file by manifest asset ID. Returns null if not permitted or not found. */
export function loadAssetById(assetId: string): string | null {
  const asset = KNOWLEDGE_MANIFEST.find((a) => a.id === assetId);
  if (!asset) return null;
  if (!asset.suppliedToLlm || asset.status !== "active" || asset.partition === "restricted") {
    return null;
  }

  if (cache.has(assetId)) return cache.get(assetId)!;

  const fullPath = join(KNOWLEDGE_DIR, asset.file);
  if (!existsSync(fullPath)) return null;

  const content = readFileSync(fullPath, "utf-8").trim();
  if (!content) return null;

  cache.set(assetId, content);
  return content;
}

/** Return the governed Risk Rising operational knowledge. */
export function loadRiskRisingKnowledge(): string {
  const content = loadAssetById("rr-operational");
  if (!content) {
    const fullPath = join(KNOWLEDGE_DIR, "Risk Rising.md");
    return loadKnowledgeFile(fullPath, "Risk Rising");
  }
  return content;
}

/** Return the governed LogicGate operational knowledge. */
export function loadLogicGateKnowledge(): string {
  const content = loadAssetById("logicgate-knowledge");
  if (!content) {
    const fullPath = join(KNOWLEDGE_DIR, "LogicGate.md");
    return loadKnowledgeFile(fullPath, "LogicGate");
  }
  return content;
}

/**
 * Pre-load all required knowledge assets and emit startup log entries.
 * Call once during server initialisation — before the first request is served.
 *
 * Required assets (status:active, suppliedToLlm:true) that are missing or
 * empty will throw. Placeholder assets are skipped silently.
 */
export function preloadKnowledge(): void {
  const activeAssets = getActiveSuppliedAssets();

  for (const asset of activeAssets) {
    const fullPath = join(KNOWLEDGE_DIR, asset.file);
    try {
      const content = loadKnowledgeFile(fullPath, asset.title);
      cache.set(asset.id, content);
      logger.info(
        {
          knowledgeAsset: asset.title,
          assetId: asset.id,
          path: asset.path,
          partition: asset.partition,
          sensitivity: asset.sensitivity,
          status: "ok",
        },
        `Knowledge loaded: ${asset.title}`,
      );
    } catch (err) {
      // Required active assets that fail to load are fatal
      logger.error(
        { assetId: asset.id, path: asset.path, err },
        `Knowledge load failed: ${asset.title}`,
      );
      throw err;
    }
  }
}

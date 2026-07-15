/**
 * Lens Routing Service — deterministic, testable routing decisions.
 *
 * Given an actor, conversation and active lens, returns a structured routing
 * decision that specifies exactly what context is permitted for this request.
 *
 * The routing service determines permission only.
 * Loading and filtering actual content is the responsibility of the
 * context-retrieval service.
 *
 * This service is deterministic and has no I/O side effects — it may be
 * tested without a database or LLM connection.
 *
 * Policy version: lens-policy-v1
 */

import {
  getLensPolicy,
  partitionPermitted,
  sensitivityPermitted,
  LENS_POLICY_VERSION,
  isValidLens,
  type Lens,
  type LensPolicy,
  type KnowledgePartition,
  type SensitivityLevel,
  type MemorySourceType,
} from "../policies/lens-policy";
import {
  KNOWLEDGE_MANIFEST,
  getActiveSuppliedAssets,
  type ManifestAsset,
} from "../lib/knowledge-manifest";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutingInput {
  /** The persisted active_lens from the conversation record. */
  activeLens: string;
}

export interface ExcludedKnowledgeAsset {
  assetId: string;
  title: string;
  partition: KnowledgePartition;
  sensitivity: SensitivityLevel;
  /** Human-readable policy reason for exclusion. */
  reason: string;
}

export interface RoutingDecision {
  /** The resolved and validated lens (defaults to analyst for unknown values). */
  activeLens: Lens;
  /** Full policy for this lens. */
  policy: LensPolicy;
  /**
   * Knowledge assets that pass all filters and may be loaded for this request.
   * Content must still be loaded by the retrieval service; this list is IDs only.
   */
  permittedKnowledgeAssets: ManifestAsset[];
  /**
   * Knowledge assets that were evaluated but excluded.
   * Stored without content — identifiers and reasons only.
   */
  excludedKnowledgeAssets: ExcludedKnowledgeAsset[];
  /** Memory source types permitted for this lens. */
  permittedMemorySources: readonly MemorySourceType[];
  /** The maximum sensitivity level this lens may receive. */
  sensitivityCeiling: SensitivityLevel;
  /** Policy version identifier — stored in retrieval traces for auditability. */
  policyVersion: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Compute a routing decision for an assistant request.
 *
 * @param input.activeLens — The persisted active_lens from the conversation.
 *   The server resolves the lens from the database; the client does not supply it.
 *
 * @returns A deterministic routing decision. Safe to call in unit tests without
 *   database access.
 */
export function computeRoutingDecision(input: RoutingInput): RoutingDecision {
  const { policy, lens } = getLensPolicy(input.activeLens);

  const permittedKnowledgeAssets: ManifestAsset[] = [];
  const excludedKnowledgeAssets: ExcludedKnowledgeAsset[] = [];

  // Evaluate every asset that is potentially suppliable to an LLM.
  // Assets with suppliedToLlm:false or status:placeholder are never permitted.
  const candidates = getActiveSuppliedAssets();

  // Also track skipped assets (non-suppliable) for completeness.
  const allKnowledgeAssets = KNOWLEDGE_MANIFEST;

  for (const asset of allKnowledgeAssets) {
    // Rule 1: restricted partition — never permitted
    if (asset.partition === "restricted") {
      excludedKnowledgeAssets.push({
        assetId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: "restricted partition — never supplied to model",
      });
      continue;
    }

    // Rule 2: suppliedToLlm:false — governance exclusion
    if (!asset.suppliedToLlm) {
      excludedKnowledgeAssets.push({
        assetId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: asset.status === "placeholder"
          ? "placeholder asset — not yet populated"
          : "governance flag: supplied_to_llm=false",
      });
      continue;
    }

    // Rule 3: status not active
    if (asset.status !== "active") {
      excludedKnowledgeAssets.push({
        assetId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: `asset status is "${asset.status}" — only active assets may be used`,
      });
      continue;
    }

    // Rule 4: partition not permitted under this lens
    if (!partitionPermitted(asset.partition, lens)) {
      excludedKnowledgeAssets.push({
        assetId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: `partition "${asset.partition}" not permitted under ${lens} lens (permitted: ${policy.permittedKnowledgePartitions.join(", ")})`,
      });
      continue;
    }

    // Rule 5: sensitivity exceeds lens ceiling
    if (!sensitivityPermitted(asset.sensitivity, policy.maxSensitivity)) {
      excludedKnowledgeAssets.push({
        assetId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: `sensitivity "${asset.sensitivity}" exceeds ${lens} lens ceiling of "${policy.maxSensitivity}"`,
      });
      continue;
    }

    // All rules pass — asset is permitted
    permittedKnowledgeAssets.push(asset);
  }

  return {
    activeLens: lens,
    policy,
    permittedKnowledgeAssets,
    excludedKnowledgeAssets,
    permittedMemorySources: policy.permittedMemorySources,
    sensitivityCeiling: policy.maxSensitivity,
    policyVersion: LENS_POLICY_VERSION,
  };
}

/**
 * Returns true if the given string is a valid constitutional lens.
 * Re-exported here as a convenience for route handlers.
 */
export { isValidLens };

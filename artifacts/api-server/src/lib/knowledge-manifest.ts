/**
 * Knowledge manifest — machine-readable registry of governed knowledge assets.
 *
 * This TypeScript file is the authoritative runtime version. The human-readable
 * governed document is knowledge/knowledge-manifest.yaml (for version control
 * and governance review). Both must be kept in sync.
 *
 * Rules:
 *   - Only assets listed here may be supplied to an LLM.
 *   - `suppliedToLlm: false` → never sent to the model.
 *   - `status: "placeholder"` → always excluded from model context.
 *   - `partition: "restricted"` → never sent to the model regardless of lens.
 *   - A chunk must never receive broader permissions than its parent asset.
 *
 * Policy version: lens-policy-v1
 */

import type { KnowledgePartition, SensitivityLevel } from "../policies/lens-policy";

export interface ManifestAsset {
  /** Stable identifier — used in retrieval traces. */
  id: string;
  /** Repository-relative path from the workspace root. */
  path: string;
  /** Filename within the knowledge/ directory. */
  file: string;
  /** Human-readable title. */
  title: string;
  /** Partition classification. */
  partition: KnowledgePartition;
  /** Sensitivity level. */
  sensitivity: SensitivityLevel;
  /** Verification state — draft | approved | superseded. */
  verificationState: "draft" | "approved" | "superseded";
  /** Lifecycle status — active assets with suppliedToLlm:true may reach the model. */
  status: "active" | "placeholder" | "deprecated";
  /** Whether this asset may be supplied to an LLM. False overrides all other rules. */
  suppliedToLlm: boolean;
  /** Owner — team or individual responsible for this asset. */
  owner: string;
  /** ISO date string of last review. */
  lastReviewedDate?: string;
}

/**
 * The governed knowledge asset registry.
 * Sync any changes here with knowledge/knowledge-manifest.yaml.
 */
export const KNOWLEDGE_MANIFEST: readonly ManifestAsset[] = [
  // ── Risk Rising — primary operational knowledge ───────────────────────────
  {
    id: "rr-operational",
    path: "knowledge/Risk Rising.md",
    file: "Risk Rising.md",
    title: "Risk Rising — Operational Knowledge",
    partition: "neutral",
    sensitivity: "internal",
    verificationState: "approved",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  // ── LogicGate — platform knowledge ───────────────────────────────────────
  {
    id: "logicgate-knowledge",
    path: "knowledge/LogicGate.md",
    file: "LogicGate.md",
    title: "LogicGate — Platform Knowledge",
    partition: "neutral",
    sensitivity: "internal",
    verificationState: "approved",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  // ── GRC domain knowledge (public domain) ─────────────────────────────────
  {
    id: "grc-domain",
    path: "knowledge/GRC.md",
    file: "GRC.md",
    title: "GRC — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "third-party-risk-domain",
    path: "knowledge/Third Party Risk.md",
    file: "Third Party Risk.md",
    title: "Third-Party Risk — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "compliance-domain",
    path: "knowledge/Compliance.md",
    file: "Compliance.md",
    title: "Compliance — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "internal-audit-domain",
    path: "knowledge/Internal Audit.md",
    file: "Internal Audit.md",
    title: "Internal Audit — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "operational-risk-domain",
    path: "knowledge/Operational Risk.md",
    file: "Operational Risk.md",
    title: "Operational Risk — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "policy-management-domain",
    path: "knowledge/Policy Management.md",
    file: "Policy Management.md",
    title: "Policy Management — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "cyber-security-domain",
    path: "knowledge/Cyber Security.md",
    file: "Cyber Security.md",
    title: "Cyber Security — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "regulations-domain",
    path: "knowledge/Regulations.md",
    file: "Regulations.md",
    title: "Regulations — Reference",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  {
    id: "industries-knowledge",
    path: "knowledge/Industries.md",
    file: "Industries.md",
    title: "Industries — Sector Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  // ── Intelligence partition — internal, lens-gated ─────────────────────────
  {
    id: "competitors-intelligence",
    path: "knowledge/Competitors.md",
    file: "Competitors.md",
    title: "Competitors — Market Intelligence",
    partition: "intelligence",
    sensitivity: "internal",
    verificationState: "draft",
    status: "active",
    suppliedToLlm: true,
    owner: "Risk Rising",
    lastReviewedDate: "2026-07-15",
  },
  // ── Restricted — governance documents, never sent to model ────────────────
  {
    id: "knowledge-governance",
    path: "knowledge/Knowledge Governance.md",
    file: "Knowledge Governance.md",
    title: "Knowledge Governance Framework",
    partition: "restricted",
    sensitivity: "internal",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
] as const;

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Returns assets that are permitted to be supplied to an LLM. */
export function getActiveSuppliedAssets(): ManifestAsset[] {
  return KNOWLEDGE_MANIFEST.filter(
    (a) => a.status === "active" && a.suppliedToLlm && a.partition !== "restricted",
  );
}

/** Looks up a manifest asset by ID. Returns undefined for unknown assets. */
export function getAssetById(id: string): ManifestAsset | undefined {
  return KNOWLEDGE_MANIFEST.find((a) => a.id === id);
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_PARTITIONS = new Set(["neutral", "intelligence", "commercial", "delivery", "restricted"]);
const VALID_SENSITIVITY = new Set(["public", "internal", "confidential", "restricted"]);
const VALID_VERIFICATION = new Set(["draft", "approved", "superseded"]);
const VALID_STATUS = new Set(["active", "placeholder", "deprecated"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate the manifest registry for structural and classification correctness.
 *
 * Enforces:
 *  - No duplicate asset IDs
 *  - No duplicate file paths
 *  - Valid partition, sensitivity, verificationState, status values
 *  - All LLM-eligible assets have owner and valid date
 *  - LLM-enabled assets must have explicit classification (not restricted)
 *  - Restricted assets must have suppliedToLlm: false
 */
export function validateManifest(): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const asset of KNOWLEDGE_MANIFEST) {
    const ctx = `[${asset.id}]`;

    // Duplicate ID
    if (seenIds.has(asset.id)) {
      errors.push(`${ctx} Duplicate asset ID "${asset.id}"`);
    }
    seenIds.add(asset.id);

    // Duplicate path
    if (seenPaths.has(asset.path)) {
      errors.push(`${ctx} Duplicate file path "${asset.path}"`);
    }
    seenPaths.add(asset.path);

    // Valid partition
    if (!VALID_PARTITIONS.has(asset.partition)) {
      errors.push(`${ctx} Unknown partition "${asset.partition}"`);
    }

    // Valid sensitivity
    if (!VALID_SENSITIVITY.has(asset.sensitivity)) {
      errors.push(`${ctx} Unknown sensitivity "${asset.sensitivity}"`);
    }

    // Valid verification state
    if (!VALID_VERIFICATION.has(asset.verificationState)) {
      errors.push(`${ctx} Unknown verificationState "${asset.verificationState}"`);
    }

    // Valid status
    if (!VALID_STATUS.has(asset.status)) {
      errors.push(`${ctx} Unknown status "${asset.status}"`);
    }

    // Restricted assets must never be LLM-eligible
    if (asset.partition === "restricted" && asset.suppliedToLlm) {
      errors.push(`${ctx} Restricted partition asset must have suppliedToLlm: false`);
    }

    // LLM-eligible active assets must have owner
    if (asset.suppliedToLlm && asset.status === "active") {
      if (!asset.owner) {
        errors.push(`${ctx} LLM-eligible active asset is missing owner`);
      }
      if (!asset.lastReviewedDate) {
        warnings.push(`${ctx} LLM-eligible active asset is missing lastReviewedDate`);
      } else if (!DATE_RE.test(asset.lastReviewedDate)) {
        warnings.push(`${ctx} lastReviewedDate "${asset.lastReviewedDate}" is not in YYYY-MM-DD format`);
      }
    }

    // LLM-enabled without adequate classification — warn on draft active assets
    if (asset.suppliedToLlm && asset.status === "active" && asset.verificationState === "draft") {
      warnings.push(
        `${ctx} LLM-eligible asset "${asset.title}" has verificationState: draft — review before treating as authoritative`,
      );
    }

    // Placeholder assets should not be LLM-eligible
    if (asset.status === "placeholder" && asset.suppliedToLlm) {
      errors.push(`${ctx} Placeholder asset must have suppliedToLlm: false`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

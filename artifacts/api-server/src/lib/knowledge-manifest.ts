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
}

/**
 * The governed knowledge asset registry.
 * Sync any changes here with knowledge/knowledge-manifest.yaml.
 */
export const KNOWLEDGE_MANIFEST: readonly ManifestAsset[] = [
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
  },
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
  },
  {
    id: "grc-domain",
    path: "knowledge/GRC.md",
    file: "GRC.md",
    title: "GRC — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "competitors-intelligence",
    path: "knowledge/Competitors.md",
    file: "Competitors.md",
    title: "Competitors — Market Intelligence",
    partition: "intelligence",
    sensitivity: "internal",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "industries-knowledge",
    path: "knowledge/Industries.md",
    file: "Industries.md",
    title: "Industries — Sector Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "internal-audit-domain",
    path: "knowledge/Internal Audit.md",
    file: "Internal Audit.md",
    title: "Internal Audit — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "cyber-security-domain",
    path: "knowledge/Cyber Security.md",
    file: "Cyber Security.md",
    title: "Cyber Security — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "third-party-risk-domain",
    path: "knowledge/Third Party Risk.md",
    file: "Third Party Risk.md",
    title: "Third-Party Risk — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "operational-risk-domain",
    path: "knowledge/Operational Risk.md",
    file: "Operational Risk.md",
    title: "Operational Risk — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "policy-management-domain",
    path: "knowledge/Policy Management.md",
    file: "Policy Management.md",
    title: "Policy Management — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "compliance-domain",
    path: "knowledge/Compliance.md",
    file: "Compliance.md",
    title: "Compliance — Domain Knowledge",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
  {
    id: "regulations-domain",
    path: "knowledge/Regulations.md",
    file: "Regulations.md",
    title: "Regulations — Reference",
    partition: "neutral",
    sensitivity: "public",
    verificationState: "draft",
    status: "placeholder",
    suppliedToLlm: false,
    owner: "Risk Rising",
  },
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

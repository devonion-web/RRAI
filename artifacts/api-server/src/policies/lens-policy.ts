/**
 * Lens Policy — canonical, central definition of RRAI's lens architecture.
 *
 * Authority: subordinate to 00_RRAI_Master_Context_v2_0.md and
 *            01_RRAI_Platform_Architecture_v1_0.md.
 *
 * This is the single source of truth for:
 *   - What each lens permits and prohibits
 *   - Which knowledge partitions each lens may access
 *   - Which opportunity fields each lens may receive
 *   - The one-way valve enforcement rules
 *   - The policy version identifier used in retrieval traces
 *
 * Do NOT scatter lens rules across route handlers, services, or frontend
 * components. Import from here.
 *
 * Policy version: lens-policy-v1
 */

// ── Policy version ────────────────────────────────────────────────────────────
// Increment when any rule changes. Historical traces carry the version at time
// of retrieval, so past outputs remain explainable after policy updates.
export const LENS_POLICY_VERSION = "lens-policy-v1" as const;

// ── Canonical lens set ────────────────────────────────────────────────────────
// Matches CONVERSATION_LENSES in lib/db/src/schema/conversations.ts.
// Must not be extended without a constitutional review.
export const LENSES = ["analyst", "intelligence", "commercial", "delivery"] as const;
export type Lens = typeof LENSES[number];

// ── Knowledge partitions ──────────────────────────────────────────────────────
export const KNOWLEDGE_PARTITIONS = [
  "neutral",
  "intelligence",
  "commercial",
  "delivery",
  "restricted",
] as const;
export type KnowledgePartition = typeof KNOWLEDGE_PARTITIONS[number];

// ── Sensitivity levels (ordered — ascending restriction) ──────────────────────
export const SENSITIVITY_LEVELS = [
  "public",
  "internal",
  "confidential",
  "highly_restricted",
] as const;
export type SensitivityLevel = typeof SENSITIVITY_LEVELS[number];

/** Returns true if `level` is at or below `ceiling` (i.e., permitted). */
export function sensitivityPermitted(
  level: SensitivityLevel,
  ceiling: SensitivityLevel,
): boolean {
  return SENSITIVITY_LEVELS.indexOf(level) <= SENSITIVITY_LEVELS.indexOf(ceiling);
}

// ── Opportunity field groups ──────────────────────────────────────────────────
// Used to select only the fields each lens is permitted to see.

/** Fields that identify the opportunity without revealing commercial detail. */
export interface OpportunityIdentityFields {
  name: string;
  stage?: string | null;
  status?: string | null;
  conversationType?: string | null;
}

/** Commercial detail — only commercial + delivery lenses. */
export interface OpportunityCommercialFields {
  customerName?: string | null;
  summary?: string | null;
  estimatedValue?: string | null;
  probability?: string | null;
}

export type OpportunityFieldGroup = "identity" | "commercial";

// ── Memory source types ───────────────────────────────────────────────────────
export const MEMORY_SOURCE_TYPES = [
  "conversation_history",
  "opportunity_identity",
  "opportunity_commercial",
  "contacts",
] as const;
export type MemorySourceType = typeof MEMORY_SOURCE_TYPES[number];

// ── Lens policy definition ────────────────────────────────────────────────────

export interface LensPolicy {
  /** Short human-readable description of what this lens does. */
  description: string;
  /** Partitions this lens may draw knowledge from. */
  permittedKnowledgePartitions: readonly KnowledgePartition[];
  /** Maximum sensitivity level this lens may receive. */
  maxSensitivity: SensitivityLevel;
  /** Opportunity field groups this lens may receive. */
  permittedOpportunityFieldGroups: readonly OpportunityFieldGroup[];
  /** Memory source types this lens may receive. */
  permittedMemorySources: readonly MemorySourceType[];
  /** Whether this lens may receive any linked opportunity context at all. */
  opportunityContextPermitted: boolean;
  /** Whether commercial detail (pricing, revenue, deal terms) is permitted. */
  commercialDetailPermitted: boolean;
  /** Whether delivery-operational detail is permitted. */
  deliveryDetailPermitted: boolean;
  /** Filename of the governed prompt fragment for this lens (relative to prompts/). */
  promptFile: string;
}

// ── Canonical lens policies ───────────────────────────────────────────────────

export const LENS_POLICIES: Record<Lens, LensPolicy> = {
  /**
   * Analyst lens — independent, vendor-neutral, evidence-led.
   *
   * One-way valve rule: commercial and delivery context MUST NOT flow in.
   * - No linked opportunity context (linking alone does not permit retrieval).
   * - No commercial knowledge assets.
   * - No delivery knowledge assets.
   * - No pricing, revenue, deal terms, or sales strategy.
   */
  analyst: {
    description:
      "Independent, evidence-led GRC analysis and thought leadership. Vendor-neutral. No commercial or delivery context.",
    permittedKnowledgePartitions: ["neutral"],
    maxSensitivity: "internal",
    permittedOpportunityFieldGroups: [],
    permittedMemorySources: ["conversation_history"],
    opportunityContextPermitted: false,
    commercialDetailPermitted: false,
    deliveryDetailPermitted: false,
    promptFile: "Lens Analyst.md",
  },

  /**
   * Intelligence lens — market, regulatory and vendor monitoring.
   * May receive opportunity identity (name and stage only) for context.
   * No commercial pricing or deal terms.
   */
  intelligence: {
    description:
      "Market, regulatory and vendor intelligence. Evidence-led, internally facing. May use opportunity name and stage.",
    permittedKnowledgePartitions: ["neutral", "intelligence"],
    maxSensitivity: "internal",
    permittedOpportunityFieldGroups: ["identity"],
    permittedMemorySources: ["conversation_history", "opportunity_identity"],
    opportunityContextPermitted: true,
    commercialDetailPermitted: false,
    deliveryDetailPermitted: false,
    promptFile: "Lens Intelligence.md",
  },

  /**
   * Commercial lens — bid and commercial support.
   * May receive full opportunity context including commercial fields.
   * Explicitly commercial; must not claim independent authority.
   */
  commercial: {
    description:
      "Bid and commercial support. Openly commercial. May use full opportunity context, pricing and deal terms.",
    permittedKnowledgePartitions: ["neutral", "intelligence", "commercial"],
    maxSensitivity: "confidential",
    permittedOpportunityFieldGroups: ["identity", "commercial"],
    permittedMemorySources: [
      "conversation_history",
      "opportunity_identity",
      "opportunity_commercial",
      "contacts",
    ],
    opportunityContextPermitted: true,
    commercialDetailPermitted: true,
    deliveryDetailPermitted: false,
    promptFile: "Lens Commercial.md",
  },

  /**
   * Delivery lens — client delivery support.
   * Broadest access: neutral + intelligence + commercial + delivery partitions.
   * Full opportunity context including delivery-operational detail.
   */
  delivery: {
    description:
      "Client delivery and implementation support. May use full opportunity context, delivery plans and operational context.",
    permittedKnowledgePartitions: ["neutral", "intelligence", "commercial", "delivery"],
    maxSensitivity: "confidential",
    permittedOpportunityFieldGroups: ["identity", "commercial"],
    permittedMemorySources: [
      "conversation_history",
      "opportunity_identity",
      "opportunity_commercial",
      "contacts",
    ],
    opportunityContextPermitted: true,
    commercialDetailPermitted: true,
    deliveryDetailPermitted: true,
    promptFile: "Lens Delivery.md",
  },
} as const;

// ── Guard helpers ─────────────────────────────────────────────────────────────

/** Returns true if the given string is a valid constitutional lens. */
export function isValidLens(value: unknown): value is Lens {
  return typeof value === "string" && (LENSES as readonly string[]).includes(value);
}

/** Returns the policy for a lens, defaulting to analyst if unknown. */
export function getLensPolicy(lens: unknown): { policy: LensPolicy; lens: Lens } {
  if (!isValidLens(lens)) {
    return { policy: LENS_POLICIES.analyst, lens: "analyst" };
  }
  return { policy: LENS_POLICIES[lens], lens };
}

/** Returns true if a knowledge partition is permitted under a given lens. */
export function partitionPermitted(
  partition: KnowledgePartition,
  lens: Lens,
): boolean {
  if (partition === "restricted") return false;
  const policy = LENS_POLICIES[lens];
  return (policy.permittedKnowledgePartitions as readonly string[]).includes(partition);
}

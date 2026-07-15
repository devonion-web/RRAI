/**
 * Retrieval Policy — centralised thresholds, vocabulary, and diversity settings.
 *
 * This file is the single source of truth for retrieval behaviour. Changes
 * here affect every search request and should be reviewed carefully.
 *
 * Policy version must be updated whenever thresholds or vocabulary change,
 * so that retrieval traces remain interpretable against the policy in force
 * at the time they were created.
 *
 * Policy version: retrieval-policy-v1.1
 */

// ── Version ───────────────────────────────────────────────────────────────────

export const RETRIEVAL_POLICY_VERSION = "retrieval-policy-v1.1";

// ── Score thresholds ──────────────────────────────────────────────────────────

export const RETRIEVAL_THRESHOLDS = {
  /**
   * Minimum ts_rank score from PostgreSQL FTS for a candidate to be considered.
   * Candidates below this threshold are treated as non-matches.
   * Value: 0.005 — filters near-zero FTS matches while keeping weak but genuine signals.
   */
  MIN_FTS_SCORE: 0.005,

  /**
   * Minimum hybrid score (FTS rank + all boosts) for a result to be included.
   * Results below this threshold are excluded and counted as "excluded below threshold".
   */
  MIN_FINAL_SCORE: 0.02,

  /**
   * Maximum chunks to evaluate from FTS before scoring (candidates).
   */
  MAX_CANDIDATES: 20,

  /**
   * Maximum chunks to return after budget filtering (selected results).
   */
  MAX_RESULTS: 10,

  /**
   * Maximum chunks from a single asset in any one result set.
   * Prevents one large document dominating the context.
   */
  MAX_CHUNKS_PER_ASSET: 4,

  /**
   * Total context character budget for knowledge content per request.
   * ~25k chars ≈ 6k tokens — leaves headroom for system prompt, history, and response.
   */
  MAX_CONTEXT_CHARS: 25_000,

  /**
   * Maximum fraction of context from a single asset (0–1).
   * Enforces source diversity when multiple assets are available.
   * Value: 0.6 — no single asset contributes more than 60% of selected context.
   */
  MAX_ASSET_FRACTION: 0.6,

  /**
   * Heading path similarity threshold for near-duplicate suppression.
   * Two chunks with the same heading path and ≥85% token overlap are treated as near-duplicates.
   * The higher-scored chunk is kept; the other receives a duplicate penalty.
   */
  NEAR_DUPLICATE_HEADING_MATCH: true,

  /**
   * Duplicate penalty applied to a chunk when its heading path has already
   * been included in the result set.
   */
  DUPLICATE_HEADING_PENALTY: -0.15,
} as const;

// ── Domain vocabulary ─────────────────────────────────────────────────────────
//
// Governed deterministic expansions for known RRAI domain terms.
// Rules:
//  - Acronyms map to their expanded forms to improve FTS recall.
//  - Product names map to common variants.
//  - UK/US spelling variants are listed where relevant.
//  - DO NOT add commercial or opportunity-specific terms.
//  - DO NOT use expansions that could change the meaning of an analyst query.
//  - Expansions are additive — the original query term is preserved.
//
// Maintenance: add new terms here when retrieval evaluation shows systematic misses
// due to acronym or variant mismatch. Bump RETRIEVAL_POLICY_VERSION on any change.

export interface VocabularyEntry {
  /** The term to recognise in the user query. */
  term: RegExp;
  /** Space-separated words to append to the enriched query. */
  expansion: string;
  /** Human-readable label for trace logging. */
  label: string;
}

export const DOMAIN_VOCABULARY: readonly VocabularyEntry[] = [
  // ── GRC core ─────────────────────────────────────────────────────────────
  { term: /\bGRC\b/,                   expansion: "governance risk compliance",                        label: "GRC" },
  { term: /\bERM\b/,                   expansion: "enterprise risk management",                        label: "ERM" },
  { term: /\bRCSA\b/,                  expansion: "risk control self assessment",                      label: "RCSA" },
  { term: /\bKRI\b/,                   expansion: "key risk indicator",                                label: "KRI" },
  { term: /\bKCI\b/,                   expansion: "key control indicator",                             label: "KCI" },

  // ── Third-party risk ─────────────────────────────────────────────────────
  { term: /\bTPRM\b/,                  expansion: "third party risk management vendor risk",           label: "TPRM" },
  { term: /\bVRM\b/,                   expansion: "vendor risk management third party risk",           label: "VRM" },

  // ── Audit ─────────────────────────────────────────────────────────────────
  { term: /\bIIA\b/,                   expansion: "institute of internal auditors audit",              label: "IIA" },
  { term: /\bSOC\s*2\b/i,             expansion: "SOC2 service organisation controls audit",          label: "SOC2" },

  // ── Compliance and regulatory ─────────────────────────────────────────────
  { term: /\bGDPR\b/,                  expansion: "general data protection regulation privacy",        label: "GDPR" },
  { term: /\bDORA\b/,                  expansion: "digital operational resilience act financial",      label: "DORA" },
  { term: /\bNIS2?\b/,                 expansion: "network information systems directive cyber",       label: "NIS2" },
  { term: /\bISO\s*27001\b/i,         expansion: "ISO27001 information security management ISMS",     label: "ISO27001" },
  { term: /\bISMS\b/,                  expansion: "information security management system ISO 27001",  label: "ISMS" },
  { term: /\bSMCR\b/,                  expansion: "senior managers certification regime accountability", label: "SMCR" },
  { term: /\bFCA\b/,                   expansion: "financial conduct authority regulated UK",          label: "FCA" },
  { term: /\bPRA\b/,                   expansion: "prudential regulation authority bank insurance",    label: "PRA" },
  { term: /\bPCI\s*DSS\b/i,          expansion: "payment card industry data security standard",      label: "PCIDSS" },

  // ── Cyber security ────────────────────────────────────────────────────────
  { term: /\bNIST\s*CSF\b/i,         expansion: "NIST cybersecurity framework identify protect detect", label: "NISTCSF" },
  { term: /\bNIST\b/,                  expansion: "national institute standards technology",           label: "NIST" },
  { term: /\bCIS\b/,                   expansion: "center internet security controls",                 label: "CIS" },
  { term: /\bRTO\b/,                   expansion: "recovery time objective business continuity",       label: "RTO" },
  { term: /\bRPO\b/,                   expansion: "recovery point objective disaster recovery",        label: "RPO" },
  { term: /\bBCP\b/,                   expansion: "business continuity plan planning",                 label: "BCP" },
  { term: /\bBCM\b/,                   expansion: "business continuity management resilience",         label: "BCM" },
  { term: /\bBIA\b/,                   expansion: "business impact analysis continuity",               label: "BIA" },

  // ── Sales and opportunity ─────────────────────────────────────────────────
  { term: /\bRFP\b/,                   expansion: "request for proposal response",                     label: "RFP" },
  { term: /\bRFI\b/,                   expansion: "request for information response",                  label: "RFI" },
  { term: /\bSoW\b/i,                  expansion: "statement of work deliverable",                     label: "SoW" },
  { term: /\bUAT\b/,                   expansion: "user acceptance testing",                           label: "UAT" },
  { term: /\bQBR\b/,                   expansion: "quarterly business review",                         label: "QBR" },
  { term: /\bBRD\b/,                   expansion: "business requirements document",                    label: "BRD" },
  { term: /\bTAM\b/,                   expansion: "total addressable market",                          label: "TAM" },

  // ── LogicGate product ─────────────────────────────────────────────────────
  { term: /\bRisk\s*Cloud\b/i,        expansion: "LogicGate Risk Cloud platform",                     label: "RiskCloud" },
  { term: /\bLogicGate\b/i,           expansion: "LogicGate Risk Cloud GRC platform",                 label: "LogicGate" },

  // ── Risk Rising ───────────────────────────────────────────────────────────
  { term: /\bRisk\s*Rising\b/i,       expansion: "Risk Rising GRC consultancy LogicGate partner",     label: "RiskRising" },

  // ── UK/US spelling normalisation ──────────────────────────────────────────
  // Only where a query in one spelling would miss content written in the other
  { term: /\borganization\b/i,        expansion: "organisation",                                      label: "org-spelling" },
  { term: /\banalyze\b/i,             expansion: "analyse",                                           label: "analyze-spelling" },
] as const;

// ── Scoring weights ───────────────────────────────────────────────────────────
//
// Applied in hybrid scoring on top of FTS rank.
// These values sum to ~1.0 maximum headroom above the base FTS score.

export const SCORING_WEIGHTS = {
  /** Maximum heading path match boost. */
  HEADING_BOOST_MAX: 0.30,
  /** Per-term heading boost increment. */
  HEADING_BOOST_PER_TERM: 0.10,
  /** Maximum tag match boost. */
  TAG_BOOST_MAX: 0.20,
  /** Per-tag boost increment. */
  TAG_BOOST_PER_TAG: 0.08,
  /** Evidence tier weights. */
  EVIDENCE_TIER: {
    governed: 0.25,
    established: 0.20,
    current: 0.10,
    observed: 0.05,
    unverified: 0.00,
  } as Record<string, number>,
  /** Verification state weights. */
  VERIFICATION_STATE: {
    approved: 0.15,
    draft: 0.05,
    superseded: -0.10,
  } as Record<string, number>,
  /** Penalty for duplicate heading path already in result set. */
  DUPLICATE_HEADING_PENALTY: RETRIEVAL_THRESHOLDS.DUPLICATE_HEADING_PENALTY,
} as const;

// ── Safe fallback vocabulary ──────────────────────────────────────────────────
//
// When FTS finds no results, a deterministic tag-based fallback is used.
// This maps query keywords to known chunk tags for approximate matching.
// This is NOT the same as the vocabulary expansion above — it is used only
// when FTS completely fails, and only for tag-level retrieval.
//
// Unlike the arbitrary evidence-tier fallback (which returned unrelated
// high-authority content), this fallback only returns content tagged
// with terms directly related to the query.

export const SAFE_FALLBACK_TAG_MAP: Record<string, string[]> = {
  grc: ["GRC"],
  governance: ["GRC"],
  "risk management": ["GRC", "Operational Risk"],
  compliance: ["GRC", "Compliance"],
  tprm: ["TPRM"],
  "third party": ["TPRM"],
  vendor: ["TPRM"],
  supplier: ["TPRM"],
  audit: ["GRC"],
  "internal audit": ["GRC"],
  cyber: ["Cyber Security", "GRC"],
  security: ["Cyber Security"],
  "iso 27001": ["Cyber Security"],
  dora: ["Cyber Security", "Compliance"],
  policy: ["GRC", "Compliance"],
  "policy management": ["GRC"],
  logicgate: ["LogicGate", "GRC"],
  "risk cloud": ["LogicGate"],
  "risk rising": ["Risk Rising"],
  implementation: ["LogicGate", "Risk Rising"],
  rfp: ["Risk Rising"],
  rfi: ["Risk Rising"],
};

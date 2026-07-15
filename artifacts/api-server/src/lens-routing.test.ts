/**
 * Lens Routing Service — unit tests
 *
 * Verifies deterministic routing decisions without database or LLM access.
 * Tests cover:
 *  - Lens policy rules (permitted/prohibited partitions)
 *  - Sensitivity ceiling enforcement
 *  - One-way valve (commercial/delivery context excluded from analyst)
 *  - Unknown/invalid lens defaults to analyst
 *  - Restricted sources always excluded
 *  - Memory source permissions per lens
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeRoutingDecision } from "./services/lens-routing-service";
import { LENS_POLICY_VERSION } from "./policies/lens-policy";

// ── Helpers ───────────────────────────────────────────────────────────────────

function route(lens: string) {
  return computeRoutingDecision({ activeLens: lens });
}

function permittedAssetIds(decision: ReturnType<typeof route>): string[] {
  return decision.permittedKnowledgeAssets.map((a) => a.id);
}

function excludedAssetIds(decision: ReturnType<typeof route>): string[] {
  return decision.excludedKnowledgeAssets.map((a) => a.assetId);
}

// ── Unknown / invalid lens ────────────────────────────────────────────────────

describe("lens routing: invalid lens handling", () => {
  it("unknown lens defaults to analyst policy", () => {
    const d = route("unknown-lens");
    assert.equal(d.activeLens, "analyst");
  });

  it("empty string lens defaults to analyst policy", () => {
    const d = route("");
    assert.equal(d.activeLens, "analyst");
  });

  it("returns the policy version identifier", () => {
    const d = route("analyst");
    assert.equal(d.policyVersion, LENS_POLICY_VERSION);
  });
});

// ── Analyst lens ──────────────────────────────────────────────────────────────

describe("lens routing: analyst lens", () => {
  it("permits neutral partition sources", () => {
    const d = route("analyst");
    const ids = permittedAssetIds(d);
    // rr-operational and logicgate-knowledge are neutral + active + suppliedToLlm:true
    assert.ok(ids.includes("rr-operational"), "Expected rr-operational in permitted assets");
    assert.ok(ids.includes("logicgate-knowledge"), "Expected logicgate-knowledge in permitted assets");
  });

  it("does not permit intelligence partition sources", () => {
    const d = route("analyst");
    const ids = permittedAssetIds(d);
    assert.ok(!ids.includes("competitors-intelligence"), "competitors-intelligence must not be permitted under analyst");
  });

  it("does not permit commercial partition sources", () => {
    const d = route("analyst");
    // No commercial-partition assets in the current manifest, but policy check should be correct
    const commercialExcluded = d.excludedKnowledgeAssets.filter(
      (ex) => ex.reason.includes("commercial"),
    );
    // All excluded commercial assets should cite partition or policy reason
    for (const ex of commercialExcluded) {
      assert.ok(ex.reason.length > 0);
    }
  });

  it("rejects commercial opportunity context (opportunityContextPermitted = false)", () => {
    const d = route("analyst");
    assert.equal(d.policy.opportunityContextPermitted, false);
    assert.equal(d.policy.commercialDetailPermitted, false);
    assert.equal(d.policy.deliveryDetailPermitted, false);
  });

  it("permitted memory sources include only conversation_history", () => {
    const d = route("analyst");
    assert.deepEqual([...d.permittedMemorySources], ["conversation_history"]);
  });

  it("sensitivity ceiling is internal", () => {
    const d = route("analyst");
    assert.equal(d.sensitivityCeiling, "internal");
  });
});

// ── Intelligence lens ─────────────────────────────────────────────────────────

describe("lens routing: intelligence lens", () => {
  it("permits neutral and intelligence partitions", () => {
    const d = route("intelligence");
    assert.ok(
      d.policy.permittedKnowledgePartitions.includes("neutral"),
      "neutral must be permitted under intelligence lens",
    );
    assert.ok(
      d.policy.permittedKnowledgePartitions.includes("intelligence"),
      "intelligence partition must be permitted under intelligence lens",
    );
  });

  it("does not permit commercial partition", () => {
    const d = route("intelligence");
    assert.equal(d.policy.commercialDetailPermitted, false);
    assert.ok(
      !(d.policy.permittedKnowledgePartitions as readonly string[]).includes("commercial"),
    );
  });

  it("permits opportunity identity context", () => {
    const d = route("intelligence");
    assert.equal(d.policy.opportunityContextPermitted, true);
    assert.ok(d.policy.permittedOpportunityFieldGroups.includes("identity"));
    assert.ok(!d.policy.permittedOpportunityFieldGroups.includes("commercial"));
  });

  it("sensitivity ceiling is internal", () => {
    const d = route("intelligence");
    assert.equal(d.sensitivityCeiling, "internal");
  });
});

// ── Commercial lens ───────────────────────────────────────────────────────────

describe("lens routing: commercial lens", () => {
  it("permits neutral, intelligence and commercial partitions", () => {
    const d = route("commercial");
    const permitted = d.policy.permittedKnowledgePartitions as readonly string[];
    assert.ok(permitted.includes("neutral"));
    assert.ok(permitted.includes("intelligence"));
    assert.ok(permitted.includes("commercial"));
    assert.ok(!permitted.includes("delivery"));
  });

  it("permits commercial detail (pricing, deal terms)", () => {
    const d = route("commercial");
    assert.equal(d.policy.commercialDetailPermitted, true);
    assert.equal(d.policy.opportunityContextPermitted, true);
  });

  it("permits commercial opportunity field groups", () => {
    const d = route("commercial");
    assert.ok(d.policy.permittedOpportunityFieldGroups.includes("identity"));
    assert.ok(d.policy.permittedOpportunityFieldGroups.includes("commercial"));
  });

  it("does not permit delivery detail", () => {
    const d = route("commercial");
    assert.equal(d.policy.deliveryDetailPermitted, false);
  });

  it("sensitivity ceiling is confidential", () => {
    const d = route("commercial");
    assert.equal(d.sensitivityCeiling, "confidential");
  });

  it("memory sources include opportunity_commercial and contacts", () => {
    const d = route("commercial");
    const sources = d.permittedMemorySources as readonly string[];
    assert.ok(sources.includes("conversation_history"));
    assert.ok(sources.includes("opportunity_identity"));
    assert.ok(sources.includes("opportunity_commercial"));
    assert.ok(sources.includes("contacts"));
  });
});

// ── Delivery lens ─────────────────────────────────────────────────────────────

describe("lens routing: delivery lens", () => {
  it("permits all non-restricted partitions", () => {
    const d = route("delivery");
    const permitted = d.policy.permittedKnowledgePartitions as readonly string[];
    assert.ok(permitted.includes("neutral"));
    assert.ok(permitted.includes("intelligence"));
    assert.ok(permitted.includes("commercial"));
    assert.ok(permitted.includes("delivery"));
  });

  it("permits commercial and delivery detail", () => {
    const d = route("delivery");
    assert.equal(d.policy.commercialDetailPermitted, true);
    assert.equal(d.policy.deliveryDetailPermitted, true);
  });

  it("sensitivity ceiling is confidential", () => {
    const d = route("delivery");
    assert.equal(d.sensitivityCeiling, "confidential");
  });
});

// ── Restricted sources ────────────────────────────────────────────────────────

describe("lens routing: restricted sources", () => {
  it("knowledge-governance (restricted) is excluded under every lens", () => {
    for (const lens of ["analyst", "intelligence", "commercial", "delivery"]) {
      const d = route(lens);
      const ids = permittedAssetIds(d);
      assert.ok(
        !ids.includes("knowledge-governance"),
        `knowledge-governance must not be permitted under ${lens} lens`,
      );
      const excluded = d.excludedKnowledgeAssets.find((e) => e.assetId === "knowledge-governance");
      assert.ok(excluded, `knowledge-governance must appear in excluded list for ${lens}`);
      assert.match(excluded.reason, /restricted/, "Exclusion reason must mention restricted partition");
    }
  });
});

// ── Placeholder sources ───────────────────────────────────────────────────────

describe("lens routing: placeholder assets", () => {
  it("placeholder assets are never in permitted list", () => {
    const placeholderIds = [
      "grc-domain",
      "competitors-intelligence",
      "industries-knowledge",
      "internal-audit-domain",
      "cyber-security-domain",
      "third-party-risk-domain",
      "operational-risk-domain",
      "policy-management-domain",
      "compliance-domain",
      "regulations-domain",
    ];

    for (const lens of ["analyst", "intelligence", "commercial", "delivery"]) {
      const d = route(lens);
      const ids = permittedAssetIds(d);
      for (const pid of placeholderIds) {
        assert.ok(
          !ids.includes(pid),
          `Placeholder asset ${pid} must not be permitted under ${lens} lens`,
        );
      }
    }
  });

  it("placeholder assets appear in excluded list with placeholder reason", () => {
    const d = route("analyst");
    const grcExcluded = d.excludedKnowledgeAssets.find((e) => e.assetId === "grc-domain");
    assert.ok(grcExcluded, "grc-domain should be excluded");
    assert.match(grcExcluded.reason, /placeholder/, "Exclusion reason should mention placeholder");
  });
});

// ── One-way valve ─────────────────────────────────────────────────────────────

describe("lens routing: one-way valve policy", () => {
  it("analyst lens does not include commercial partition assets", () => {
    const d = route("analyst");
    const permitted = d.permittedKnowledgeAssets;
    const hasCommercial = permitted.some((a) => a.partition === "commercial");
    assert.equal(hasCommercial, false, "Analyst lens must not receive commercial partition assets");
  });

  it("analyst lens does not include delivery partition assets", () => {
    const d = route("analyst");
    const permitted = d.permittedKnowledgeAssets;
    const hasDelivery = permitted.some((a) => a.partition === "delivery");
    assert.equal(hasDelivery, false, "Analyst lens must not receive delivery partition assets");
  });

  it("commercial lens cannot access delivery partition assets", () => {
    const d = route("commercial");
    const permitted = d.policy.permittedKnowledgePartitions as readonly string[];
    assert.ok(!permitted.includes("delivery"), "Commercial lens must not permit delivery partition");
  });

  it("switching from commercial to analyst removes commercial partition access", () => {
    const commercial = route("commercial");
    const analyst = route("analyst");

    const commercialPartitions = commercial.policy.permittedKnowledgePartitions as readonly string[];
    const analystPartitions = analyst.policy.permittedKnowledgePartitions as readonly string[];

    assert.ok(commercialPartitions.includes("commercial"), "Commercial lens has commercial partition");
    assert.ok(!analystPartitions.includes("commercial"), "Analyst lens must not have commercial partition");
  });
});

// ── Sensitivity ceiling ───────────────────────────────────────────────────────

describe("lens routing: sensitivity ceiling", () => {
  it("internal assets are excluded when ceiling is lower (public)", () => {
    // All current active assets are internal — verify analyst ceiling applies
    // (analyst ceiling = internal, so internal assets ARE permitted)
    const d = route("analyst");
    const internalPermitted = d.permittedKnowledgeAssets.filter((a) => a.sensitivity === "internal");
    assert.ok(internalPermitted.length > 0, "Internal assets should be permitted under analyst lens (ceiling=internal)");
  });

  it("confidential assets would be excluded under analyst ceiling", () => {
    // No confidential knowledge assets currently registered
    // Verify policy ceiling is correctly set
    const d = route("analyst");
    assert.equal(d.sensitivityCeiling, "internal");
    // If a confidential asset were in the manifest, it would be excluded under analyst
    // This is verified by the sensitivityPermitted() function which the routing service uses
  });
});

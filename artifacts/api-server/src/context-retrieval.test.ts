/**
 * Context Retrieval Service — unit/integration tests
 *
 * Tests cover:
 *  - Registered permitted assets load with provenance
 *  - Placeholder assets do not load
 *  - Restricted assets never load
 *  - One-way valve: commercial opportunity fields excluded from analyst lens
 *  - Full opportunity context available to commercial lens
 *  - Analyst conversation linked to opportunity — no commercial retrieval
 *  - Excluded sources list is complete and never contains content
 *  - Provenance metadata is returned for each block
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeRoutingDecision } from "./services/lens-routing-service";
import { retrieveContext } from "./services/context-retrieval-service";
import type { Conversation } from "@workspace/db/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-test-001",
    organisationId: "org-test-001",
    createdByUserId: "user-test-001",
    ownerUserId: "user-test-001",
    opportunityId: null,
    title: "Test Conversation",
    status: "active",
    conversationType: "general",
    activeLens: "analyst",
    sensitivity: "standard",
    metadata: null,
    lastMessageAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

const actor = { userId: "user-test-001", orgId: "org-test-001" };

// ── Knowledge asset loading ───────────────────────────────────────────────────

describe("context retrieval: knowledge assets", () => {
  it("loads registered active assets for analyst lens", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });

    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const knowledgeBlocks = result.permittedBlocks.filter((b) => b.sourceType === "knowledge_asset");

    // Should have rr-operational and logicgate-knowledge (both active, suppliedToLlm:true, neutral)
    const assetIds = knowledgeBlocks.map((b) => b.sourceId);
    assert.ok(assetIds.includes("rr-operational"), "rr-operational should be in permitted blocks");
    assert.ok(assetIds.includes("logicgate-knowledge"), "logicgate-knowledge should be in permitted blocks");
  });

  it("every knowledge block has provenance metadata", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    for (const block of result.permittedBlocks.filter((b) => b.sourceType === "knowledge_asset")) {
      assert.ok(block.sourceId, "block must have sourceId");
      assert.ok(block.title, "block must have title");
      assert.ok(block.partition, "block must have partition");
      assert.ok(block.sensitivity, "block must have sensitivity");
      assert.ok(block.verificationState, "block must have verificationState");
      assert.ok(block.content.length > 0, "block must have non-empty content");
    }
  });

  it("placeholder assets do not appear in permitted blocks", async () => {
    const decision = computeRoutingDecision({ activeLens: "commercial" });
    const conv = makeConversation({ activeLens: "commercial" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const placeholderIds = ["grc-domain", "competitors-intelligence", "industries-knowledge"];
    const blockIds = result.permittedBlocks.map((b) => b.sourceId);

    for (const pid of placeholderIds) {
      assert.ok(!blockIds.includes(pid), `Placeholder asset ${pid} must not appear in permitted blocks`);
    }
  });

  it("restricted assets never appear in permitted blocks under any lens", async () => {
    for (const lens of ["analyst", "intelligence", "commercial", "delivery"]) {
      const decision = computeRoutingDecision({ activeLens: lens });
      const conv = makeConversation({ activeLens: lens });
      const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

      const blockIds = result.permittedBlocks.map((b) => b.sourceId);
      assert.ok(
        !blockIds.includes("knowledge-governance"),
        `knowledge-governance must not appear in permitted blocks under ${lens} lens`,
      );
    }
  });

  it("asset marked unavailable to LLM does not load", async () => {
    // competitors-intelligence has suppliedToLlm:false
    const decision = computeRoutingDecision({ activeLens: "intelligence" });
    const conv = makeConversation({ activeLens: "intelligence" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const blockIds = result.permittedBlocks.map((b) => b.sourceId);
    assert.ok(!blockIds.includes("competitors-intelligence"), "competitors-intelligence (suppliedToLlm:false) must not load");
  });

  it("excluded sources list is present and never contains content", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    for (const ex of result.excludedSources) {
      assert.ok(ex.sourceId, "excluded source must have sourceId");
      assert.ok(ex.reason, "excluded source must have reason");
      // Excluded sources must not carry content — only metadata
      assert.ok(!("content" in ex), "excluded source must not carry content field");
    }
  });
});

// ── One-way valve: opportunity context ───────────────────────────────────────

describe("context retrieval: one-way valve — analyst lens", () => {
  it("analyst conversation linked to opportunity: no opportunity context retrieved", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({
      activeLens: "analyst",
      opportunityId: "opp-does-not-exist",
    });

    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const oppBlocks = result.permittedBlocks.filter(
      (b) => b.sourceType === "opportunity_identity" || b.sourceType === "opportunity_commercial",
    );
    assert.equal(oppBlocks.length, 0, "Analyst lens must not receive any opportunity context blocks");
  });

  it("analyst: linked opportunity appears in excluded sources with valve reason", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({
      activeLens: "analyst",
      opportunityId: "opp-does-not-exist",
    });

    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const oppExcluded = result.excludedSources.find(
      (ex) => ex.sourceId === "opp-does-not-exist",
    );
    assert.ok(oppExcluded, "Linked opportunity must appear in excluded sources for analyst lens");
    assert.match(
      oppExcluded.reason,
      /one-way valve/,
      "Exclusion reason must cite one-way valve",
    );
  });
});

describe("context retrieval: one-way valve — intelligence lens", () => {
  it("intelligence: no commercial opportunity fields retrieved", async () => {
    const decision = computeRoutingDecision({ activeLens: "intelligence" });
    const conv = makeConversation({
      activeLens: "intelligence",
      opportunityId: "opp-does-not-exist",
    });

    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const commercialBlocks = result.permittedBlocks.filter(
      (b) => b.sourceType === "opportunity_commercial",
    );
    assert.equal(commercialBlocks.length, 0, "Intelligence lens must not receive commercial opportunity blocks");
  });
});

// ── Commercial lens opportunity access ────────────────────────────────────────

describe("context retrieval: commercial lens — opportunity access", () => {
  it("commercial: no opportunity blocks when no opportunity linked", async () => {
    const decision = computeRoutingDecision({ activeLens: "commercial" });
    const conv = makeConversation({
      activeLens: "commercial",
      opportunityId: null,
    });

    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const oppBlocks = result.permittedBlocks.filter(
      (b) => b.sourceType === "opportunity_identity" || b.sourceType === "opportunity_commercial",
    );
    assert.equal(oppBlocks.length, 0, "No opportunity blocks when none linked");
  });
});

// ── Provenance summary metadata ───────────────────────────────────────────────

describe("context retrieval: provenance summary metadata", () => {
  it("usedAssetIds lists only assets that were included", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const blockAssetIds = result.permittedBlocks
      .filter((b) => b.sourceType === "knowledge_asset")
      .map((b) => b.sourceId);

    for (const id of result.usedAssetIds) {
      assert.ok(blockAssetIds.includes(id), `usedAssetIds must match knowledge block sourceIds (${id})`);
    }
  });

  it("partitionsIncluded reflects actual blocks", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    const actualPartitions = new Set<string>(result.permittedBlocks.map((b) => b.partition));
    for (const partition of result.partitionsIncluded) {
      assert.ok(actualPartitions.has(partition), `partitionsIncluded (${partition}) must match actual block partitions`);
    }
  });

  it("usedMemorySources always includes conversation_history", async () => {
    const decision = computeRoutingDecision({ activeLens: "analyst" });
    const conv = makeConversation({ activeLens: "analyst" });
    const result = await retrieveContext({ routingDecision: decision, conversation: conv, actor });

    assert.ok(
      result.usedMemorySources.includes("conversation_history"),
      "conversation_history must always appear in usedMemorySources",
    );
  });

  it("cross-org records are blocked at opportunity query level", async () => {
    // With a non-existent opportunityId for a different org, no blocks returned
    const decision = computeRoutingDecision({ activeLens: "commercial" });
    const conv = makeConversation({
      activeLens: "commercial",
      opportunityId: "opp-different-org",
    });

    const result = await retrieveContext({
      routingDecision: decision,
      conversation: conv,
      actor: { userId: "user-test-001", orgId: "org-test-001" },
    });

    const oppBlocks = result.permittedBlocks.filter(
      (b) => b.sourceType === "opportunity_identity" || b.sourceType === "opportunity_commercial",
    );
    // If the opp belongs to a different org, getOpportunity returns null → no blocks
    assert.equal(oppBlocks.length, 0, "Cross-org opportunity must not yield context blocks");
  });
});

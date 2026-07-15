/**
 * Context Retrieval Service — loads and filters content for prompt assembly.
 *
 * Receives a routing decision from lens-routing-service and returns structured,
 * provenance-tagged context blocks that prompt assembly may include directly.
 *
 * Rules:
 *   - Routing decision is applied BEFORE search — only permitted assets are searched.
 *   - Opportunity fields are selected at the field level — never the full record.
 *   - The one-way valve is enforced here: commercial/delivery fields are excluded
 *     for analyst and intelligence lenses regardless of opportunity linkage.
 *   - No raw database records are injected blindly into prompts.
 *   - Every block carries source metadata for traceability.
 *   - Knowledge content is retrieved via chunk search, not whole-file loading.
 *
 * Policy version: lens-policy-v1
 * Search version: retrieval-v1
 */

import type { Conversation } from "@workspace/db/schema";
import type { RoutingDecision } from "./lens-routing-service";
import type { KnowledgePartition, SensitivityLevel, MemorySourceType } from "../policies/lens-policy";
import * as oppsRepo from "../repositories/opportunities-repository";
import { searchKnowledge, type SearchOutput } from "./knowledge-search-service";
import { logger } from "../lib/logger";

// ── Context block types ───────────────────────────────────────────────────────

/** Source type taxonomy for retrieval traces. */
export type ContextSourceType =
  | "knowledge_chunk"
  | "knowledge_asset"     // kept for backwards compat in traces
  | "opportunity_identity"
  | "opportunity_commercial"
  | "conversation_context";

export interface ContextBlock {
  /** What kind of source this came from. */
  sourceType: ContextSourceType;
  /** Stable identifier — chunk ID, knowledge asset ID, opportunity ID, or conversation ID. */
  sourceId: string;
  /** Asset ID (for knowledge chunks — same as assetId in the chunk). */
  assetId?: string;
  /** Human-readable title for the block. */
  title: string;
  /** Heading path within the source document (knowledge chunks only). */
  headingPath?: string;
  /** Chunk index within the source document (knowledge chunks only). */
  chunkIndex?: number;
  /** Partition classification inherited from the manifest or policy. */
  partition: KnowledgePartition;
  /** Sensitivity level inherited from the manifest or policy. */
  sensitivity: SensitivityLevel;
  /** Verification state of the source. */
  verificationState: string;
  /** Evidence tier of the source (knowledge chunks only). */
  evidenceTier?: string;
  /** Relevance score (knowledge chunks only). */
  score?: number;
  /** The actual content that may be supplied to the model. */
  content: string;
}

export interface ExcludedSource {
  sourceId: string;
  title: string;
  partition: KnowledgePartition;
  sensitivity: SensitivityLevel;
  reason: string;
}

export interface RetrievalResult {
  /** Context blocks that have passed all filters — safe to include in prompt. */
  permittedBlocks: ContextBlock[];
  /** Sources evaluated but excluded — for traceability only; never content. */
  excludedSources: ExcludedSource[];
  /** Knowledge asset IDs that were included. */
  usedAssetIds: string[];
  /** Memory source types that were included. */
  usedMemorySources: MemorySourceType[];
  /** Unique partition values of included blocks. */
  partitionsIncluded: KnowledgePartition[];
  /** Unique sensitivity values of included blocks. */
  sensitivityLevelsIncluded: SensitivityLevel[];
  /** The search output from the knowledge search service (for trace enrichment). */
  searchOutput?: SearchOutput;
}

// ── Opportunity context selection ─────────────────────────────────────────────
// Fields are selected at the individual field level — never the full record.

interface OpportunityIdentityContext {
  name: string;
  stage?: string | null;
  status?: string | null;
}

interface OpportunityCommercialContext {
  customerName?: string | null;
  summary?: string | null;
  estimatedValue?: string | null;
  probability?: string | null;
  currency?: string | null;
}

function formatIdentityBlock(opp: OpportunityIdentityContext): string {
  const lines = [`Opportunity name: ${opp.name}`];
  if (opp.stage) lines.push(`Stage: ${opp.stage}`);
  if (opp.status) lines.push(`Status: ${opp.status}`);
  return lines.join("\n");
}

function formatCommercialBlock(opp: OpportunityCommercialContext): string {
  const lines: string[] = [];
  if (opp.customerName) lines.push(`Customer: ${opp.customerName}`);
  if (opp.summary) lines.push(`Summary: ${opp.summary}`);
  if (opp.estimatedValue) {
    const currency = opp.currency ?? "GBP";
    lines.push(`Estimated value: ${currency} ${opp.estimatedValue}`);
  }
  if (opp.probability) lines.push(`Win probability: ${opp.probability}%`);
  return lines.join("\n");
}

// ── Main retrieval function ───────────────────────────────────────────────────

export interface RetrievalInput {
  routingDecision: RoutingDecision;
  conversation: Conversation;
  actor: { userId: string; orgId: string };
  /** The user's current message — used as the search query for chunk retrieval. */
  userQuery?: string;
}

/**
 * Load and filter all context permitted by the routing decision.
 *
 * Knowledge content is retrieved via semantic chunk search (PostgreSQL FTS).
 * Opportunity context is retrieved from the database with field-level selection.
 *
 * Returns structured blocks with provenance — ready for prompt assembly.
 */
export async function retrieveContext(input: RetrievalInput): Promise<RetrievalResult> {
  const { routingDecision, conversation, actor, userQuery = "" } = input;
  const { policy, permittedKnowledgeAssets, excludedKnowledgeAssets } = routingDecision;

  const permittedBlocks: ContextBlock[] = [];
  const excludedSources: ExcludedSource[] = [];
  const usedAssetIds: string[] = [];
  const usedMemorySources = new Set<MemorySourceType>();

  // ── 1. Knowledge chunks (chunk-based retrieval) ────────────────────────────

  let searchOutput: SearchOutput | undefined;

  const indexableAssets = permittedKnowledgeAssets.filter((a) => a.suppliedToLlm);

  if (indexableAssets.length > 0) {
    try {
      const permittedPartitions = policy.permittedKnowledgePartitions as string[];

      searchOutput = await searchKnowledge({
        userQuery: userQuery || conversation.title || "general knowledge",
        permittedAssetIds: indexableAssets.map((a) => a.id),
        permittedPartitions,
        sensitivityCeiling: routingDecision.sensitivityCeiling,
        permittedAssets: indexableAssets,
        maxResults: 12,
        charBudget: 25_000,
        activeLens: routingDecision.activeLens,
        conversationType: conversation.conversationType,
      });

      // Convert search results to context blocks
      for (const result of searchOutput.results) {
        const asset = indexableAssets.find((a) => a.id === result.assetId);
        if (!asset) continue;

        permittedBlocks.push({
          sourceType: "knowledge_chunk",
          sourceId: result.chunkId,
          assetId: result.assetId,
          title: result.title,
          headingPath: result.headingPath,
          chunkIndex: result.chunkIndex,
          partition: asset.partition as KnowledgePartition,
          sensitivity: asset.sensitivity as SensitivityLevel,
          verificationState: result.verificationState,
          evidenceTier: result.evidenceTier,
          score: result.score,
          content: result.content,
        });

        if (!usedAssetIds.includes(result.assetId)) {
          usedAssetIds.push(result.assetId);
        }
      }

      // Propagate sensitivity exclusions from search
      for (const ex of searchOutput.excluded) {
        const asset = indexableAssets.find((a) => a.id === ex.assetId);
        if (asset) {
          excludedSources.push({
            sourceId: ex.assetId,
            title: asset.title,
            partition: asset.partition as KnowledgePartition,
            sensitivity: asset.sensitivity as SensitivityLevel,
            reason: ex.reason,
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "context-retrieval: knowledge search failed — falling back to empty context");
      // Non-fatal — return empty knowledge context rather than crashing
    }
  }

  // Carry excluded knowledge assets from routing decision into excluded sources
  for (const ex of excludedKnowledgeAssets) {
    excludedSources.push({
      sourceId: ex.assetId,
      title: ex.title,
      partition: ex.partition,
      sensitivity: ex.sensitivity,
      reason: ex.reason,
    });
  }

  // ── 2. Opportunity context (memory) ────────────────────────────────────────

  if (conversation.opportunityId && policy.opportunityContextPermitted) {
    try {
      const opp = await oppsRepo.getOpportunity(conversation.opportunityId, actor.orgId);

      if (opp) {
        // Identity fields — permitted to intelligence + commercial + delivery
        const identityGroups = policy.permittedOpportunityFieldGroups;

        if (identityGroups.includes("identity")) {
          const identityText = formatIdentityBlock({
            name: opp.name,
            stage: opp.stage,
            status: opp.status,
          });

          if (identityText.trim()) {
            permittedBlocks.push({
              sourceType: "opportunity_identity",
              sourceId: opp.id,
              title: `Linked Opportunity — ${opp.name}`,
              partition: "neutral",
              sensitivity: "internal",
              verificationState: "observed",
              content: identityText,
            });
            usedMemorySources.add("opportunity_identity");
          }
        }

        // Commercial fields — only commercial + delivery lenses
        if (identityGroups.includes("commercial") && policy.commercialDetailPermitted) {
          const commercialText = formatCommercialBlock({
            customerName: opp.customerName,
            summary: opp.summary,
            estimatedValue: opp.estimatedValue?.toString(),
            probability: opp.probability?.toString(),
            currency: opp.currency,
          });

          if (commercialText.trim()) {
            permittedBlocks.push({
              sourceType: "opportunity_commercial",
              sourceId: opp.id,
              title: `Linked Opportunity — Commercial Context`,
              partition: "commercial",
              sensitivity: "confidential",
              verificationState: "observed",
              content: commercialText,
            });
            usedMemorySources.add("opportunity_commercial");
          }
        } else if (!identityGroups.includes("commercial")) {
          // Log one-way valve enforcement for analyst/intelligence
          excludedSources.push({
            sourceId: opp.id,
            title: "Linked Opportunity — Commercial Context",
            partition: "commercial",
            sensitivity: "confidential",
            reason: `one-way valve: commercial opportunity detail not permitted under ${routingDecision.activeLens} lens`,
          });
        }
      }
    } catch (err) {
      logger.warn({ err, opportunityId: conversation.opportunityId }, "context-retrieval: failed to load opportunity");
    }
  } else if (conversation.opportunityId && !policy.opportunityContextPermitted) {
    // One-way valve: analyst lens — opportunity exists but no context permitted
    excludedSources.push({
      sourceId: conversation.opportunityId,
      title: "Linked Opportunity",
      partition: "commercial",
      sensitivity: "confidential",
      reason: `one-way valve: no opportunity context permitted under ${routingDecision.activeLens} lens — linking alone does not grant retrieval`,
    });
  }

  // Always include conversation history as a memory source (handled by prompt assembly)
  usedMemorySources.add("conversation_history");

  // ── 3. Compute summary metadata ────────────────────────────────────────────

  const partitionsIncluded = [...new Set(permittedBlocks.map((b) => b.partition))] as KnowledgePartition[];
  const sensitivityLevelsIncluded = [...new Set(permittedBlocks.map((b) => b.sensitivity))] as SensitivityLevel[];

  return {
    permittedBlocks,
    excludedSources,
    usedAssetIds,
    usedMemorySources: [...usedMemorySources],
    partitionsIncluded,
    sensitivityLevelsIncluded,
    searchOutput,
  };
}

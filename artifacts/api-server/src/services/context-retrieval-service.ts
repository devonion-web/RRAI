/**
 * Context Retrieval Service — loads and filters content for prompt assembly.
 *
 * Receives a routing decision from lens-routing-service and returns structured,
 * provenance-tagged context blocks that prompt assembly may include directly.
 *
 * Rules:
 *   - Only assets approved by the routing decision are loaded.
 *   - Opportunity fields are selected at the field level — never the full record.
 *   - The one-way valve is enforced here: commercial/delivery fields are excluded
 *     for analyst and intelligence lenses regardless of opportunity linkage.
 *   - No raw database records are injected blindly into prompts.
 *   - Every block carries source metadata for traceability.
 *
 * Policy version: lens-policy-v1
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Conversation } from "@workspace/db/schema";
import type { RoutingDecision } from "./lens-routing-service";
import type { KnowledgePartition, SensitivityLevel, MemorySourceType } from "../policies/lens-policy";
import * as oppsRepo from "../repositories/opportunities-repository";
import { logger } from "../lib/logger";

// ── Path resolution ───────────────────────────────────────────────────────────
// Workspace root is two levels above the api-server package dir.
const WORKSPACE_ROOT = join(process.cwd(), "..", "..");

// ── Context block types ───────────────────────────────────────────────────────

/** Source type taxonomy for retrieval traces. */
export type ContextSourceType =
  | "knowledge_asset"
  | "opportunity_identity"
  | "opportunity_commercial"
  | "conversation_context";

export interface ContextBlock {
  /** What kind of source this came from. */
  sourceType: ContextSourceType;
  /** Stable identifier — knowledge asset ID, opportunity ID, or conversation ID. */
  sourceId: string;
  /** Human-readable title for the block. */
  title: string;
  /** Partition classification inherited from the manifest or policy. */
  partition: KnowledgePartition;
  /** Sensitivity level inherited from the manifest or policy. */
  sensitivity: SensitivityLevel;
  /** Verification state of the source. */
  verificationState: string;
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
}

// ── Knowledge asset loading ───────────────────────────────────────────────────

function tryLoadKnowledgeFile(file: string): string | null {
  const fullPath = join(WORKSPACE_ROOT, "knowledge", file);
  if (!existsSync(fullPath)) return null;
  try {
    const content = readFileSync(fullPath, "utf-8").trim();
    return content || null;
  } catch {
    return null;
  }
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
}

/**
 * Load and filter all context permitted by the routing decision.
 * Returns structured blocks with provenance — ready for prompt assembly.
 */
export async function retrieveContext(input: RetrievalInput): Promise<RetrievalResult> {
  const { routingDecision, conversation, actor } = input;
  const { policy, permittedKnowledgeAssets, excludedKnowledgeAssets } = routingDecision;

  const permittedBlocks: ContextBlock[] = [];
  const excludedSources: ExcludedSource[] = [];
  const usedAssetIds: string[] = [];
  const usedMemorySources = new Set<MemorySourceType>();

  // ── 1. Knowledge assets ────────────────────────────────────────────────────

  for (const asset of permittedKnowledgeAssets) {
    const content = tryLoadKnowledgeFile(asset.file);

    if (!content) {
      excludedSources.push({
        sourceId: asset.id,
        title: asset.title,
        partition: asset.partition,
        sensitivity: asset.sensitivity,
        reason: "knowledge file missing or empty at runtime — skipped safely",
      });
      logger.warn({ assetId: asset.id, file: asset.file }, "context-retrieval: knowledge file missing");
      continue;
    }

    permittedBlocks.push({
      sourceType: "knowledge_asset",
      sourceId: asset.id,
      title: asset.title,
      partition: asset.partition,
      sensitivity: asset.sensitivity,
      verificationState: asset.verificationState,
      content,
    });
    usedAssetIds.push(asset.id);
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
  };
}

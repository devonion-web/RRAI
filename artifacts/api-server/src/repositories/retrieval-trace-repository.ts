/**
 * Retrieval Trace Repository — append-only audit trail for context retrieval.
 *
 * Each record documents exactly what information was available to the model
 * for a given assistant response, and what was excluded and why.
 *
 * Reads:
 *   - Admin-only query: getTraceByMessage, listTracesByConversation
 *
 * Writes:
 *   - createTrace (append-only — no updates, no deletes)
 */

import { db } from "@workspace/db";
import {
  retrievalTracesTable,
  type RetrievalTrace,
  type ChunkScoreSummary,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

export interface CreateTraceInput {
  organisationId: string;
  conversationId: string;
  messageId?: string | null;
  activeLens: string;
  policyVersion: string;
  knowledgeAssetIds: string[];
  memorySourceTypes: string[];
  partitionsIncluded: string[];
  sensitivityLevelsIncluded: string[];
  excludedSources: Array<{
    sourceId: string;
    title: string;
    partition: string;
    sensitivity: string;
    reason: string;
  }>;
  // ── Search metadata (optional — present only when retrieval engine is used) ─
  searchQuery?: string | null;
  searchVersion?: string | null;
  chunkPolicyVersion?: string | null;
  candidateCount?: number | null;
  selectedChunkIds?: string[] | null;
  scoreSummaries?: ChunkScoreSummary[] | null;
  evidenceTiersUsed?: string[] | null;
  verificationStatesUsed?: string[] | null;
  omittedDueToBudget?: number | null;
  contextCharEstimate?: number | null;
}

/** Create a retrieval trace record. Append-only — never updates existing records. */
export async function createTrace(input: CreateTraceInput) {
  const [row] = await db
    .insert(retrievalTracesTable)
    .values({
      organisationId: input.organisationId,
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      activeLens: input.activeLens,
      policyVersion: input.policyVersion,
      knowledgeAssetIds: input.knowledgeAssetIds,
      memorySourceTypes: input.memorySourceTypes,
      partitionsIncluded: input.partitionsIncluded,
      sensitivityLevelsIncluded: input.sensitivityLevelsIncluded,
      excludedSources: input.excludedSources,
      // Search metadata
      searchQuery: input.searchQuery ?? null,
      searchVersion: input.searchVersion ?? null,
      chunkPolicyVersion: input.chunkPolicyVersion ?? null,
      candidateCount: input.candidateCount ?? null,
      selectedChunkIds: input.selectedChunkIds ?? null,
      scoreSummaries: input.scoreSummaries ?? null,
      evidenceTiersUsed: input.evidenceTiersUsed ?? null,
      verificationStatesUsed: input.verificationStatesUsed ?? null,
      omittedDueToBudget: input.omittedDueToBudget ?? null,
      contextCharEstimate: input.contextCharEstimate ?? null,
    })
    .returning();
  return row;
}

/** Get the retrieval trace for a specific assistant message. Admin use only. */
export async function getTraceByMessage(messageId: string, orgId: string) {
  const [row] = await db
    .select()
    .from(retrievalTracesTable)
    .where(eq(retrievalTracesTable.messageId, messageId))
    .limit(1);

  if (!row) return null;
  // Org-scope guard
  if (row.organisationId !== orgId) return null;
  return row;
}

/** List retrieval traces for a conversation (newest first). Admin use only. */
export async function listTracesByConversation(conversationId: string, orgId: string, limit = 50) {
  return db
    .select()
    .from(retrievalTracesTable)
    .where(eq(retrievalTracesTable.conversationId, conversationId))
    .orderBy(desc(retrievalTracesTable.retrievedAt))
    .limit(limit)
    .then((rows: RetrievalTrace[]) => rows.filter((r: RetrievalTrace) => r.organisationId === orgId));
}

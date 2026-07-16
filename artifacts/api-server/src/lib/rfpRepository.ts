/**
 * RFP Repository — Phase 1: Persistent Work Item Foundation.
 *
 * All async DB operations for the requirement-based RFP flow.
 * Returns DB row types from the rfp schema. Callers are responsible for
 * mapping to application-level types (BidPack, Requirement, etc.).
 *
 * Audit events are append-only — no update or delete method is exposed.
 * Quality review overrides update the existing row (not a new row) because
 * a gate override is an in-place mutation of the same gate record.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  rfpWorkItemsTable,
  rfpDocumentsTable,
  rfpRequirementsTable,
  rfpResponsesTable,
  rfpResponseBlocksTable,
  rfpQualityReviewsTable,
  rfpAuditEventsTable,
  type RfpWorkItem,
  type InsertRfpWorkItem,
  type RfpDocument,
  type InsertRfpDocument,
  type RfpRequirement,
  type InsertRfpRequirement,
  type RfpResponse,
  type RfpResponseBlock,
  type InsertRfpResponseBlock,
  type RfpQualityReview,
  type InsertRfpQualityReview,
  type RfpAuditEvent,
  type InsertRfpAuditEvent,
} from "@workspace/db";

// ── Re-exports for callers that need DB row types ─────────────────────────────

export type {
  RfpWorkItem,
  RfpDocument,
  RfpRequirement,
  RfpResponse,
  RfpResponseBlock,
  RfpQualityReview,
  RfpAuditEvent,
};

// ── Work Items ────────────────────────────────────────────────────────────────

export async function createWorkItem(
  data: InsertRfpWorkItem,
): Promise<RfpWorkItem> {
  const [row] = await db
    .insert(rfpWorkItemsTable)
    .values(data)
    .returning();
  return row;
}

export async function getWorkItem(id: string): Promise<RfpWorkItem | null> {
  const [row] = await db
    .select()
    .from(rfpWorkItemsTable)
    .where(eq(rfpWorkItemsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateWorkItem(
  id: string,
  data: Partial<InsertRfpWorkItem>,
): Promise<RfpWorkItem | null> {
  const [row] = await db
    .update(rfpWorkItemsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rfpWorkItemsTable.id, id))
    .returning();
  return row ?? null;
}

export async function listRecentWorkItems(
  limit = 20,
): Promise<RfpWorkItem[]> {
  return db
    .select()
    .from(rfpWorkItemsTable)
    .orderBy(desc(rfpWorkItemsTable.createdAt))
    .limit(limit);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function storeDocument(
  data: InsertRfpDocument,
): Promise<RfpDocument> {
  const [row] = await db
    .insert(rfpDocumentsTable)
    .values(data)
    .returning();
  return row;
}

export async function getDocument(id: string): Promise<RfpDocument | null> {
  const [row] = await db
    .select()
    .from(rfpDocumentsTable)
    .where(eq(rfpDocumentsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function getDocuments(ids: string[]): Promise<RfpDocument[]> {
  if (!ids.length) return [];
  return db
    .select()
    .from(rfpDocumentsTable)
    .where(inArray(rfpDocumentsTable.id, ids));
}

export async function deleteDocument(id: string): Promise<void> {
  await db
    .delete(rfpDocumentsTable)
    .where(eq(rfpDocumentsTable.id, id));
}

// ── Profile (stored inline on rfp_work_items) ─────────────────────────────────

export interface StoredProfile {
  id: string;
  bidPackId: string;
  ourRole: string;
  primePartner: string;
  ourRemit: string[];
  otherParties: string[];
  createdAt: number;
  updatedAt: number;
}

export async function saveProfile(
  packId: string,
  data: { ourRole: string; primePartner: string; ourRemit: string[]; otherParties: string[] },
): Promise<StoredProfile | null> {
  const now = Date.now();
  const existing = await getWorkItem(packId);
  if (!existing) return null;

  const existingProfile = existing.profile as StoredProfile | null;
  const profile: StoredProfile = {
    id:           existingProfile?.id ?? packId,
    bidPackId:    packId,
    ourRole:      data.ourRole,
    primePartner: data.primePartner,
    ourRemit:     data.ourRemit,
    otherParties: data.otherParties,
    createdAt:    existingProfile?.createdAt ?? now,
    updatedAt:    now,
  };

  await db
    .update(rfpWorkItemsTable)
    .set({ profile, updatedAt: new Date() })
    .where(eq(rfpWorkItemsTable.id, packId));

  return profile;
}

export async function getProfile(packId: string): Promise<StoredProfile | null> {
  const [row] = await db
    .select({ profile: rfpWorkItemsTable.profile })
    .from(rfpWorkItemsTable)
    .where(eq(rfpWorkItemsTable.id, packId))
    .limit(1);
  if (!row) return null;
  return (row.profile as StoredProfile | null) ?? null;
}

// ── Requirements ──────────────────────────────────────────────────────────────

/**
 * Replace all requirements for a work item.
 * Deletes existing rows (cascades to responses and blocks) then inserts fresh.
 * This matches the current in-memory behaviour where saveRequirements always
 * replaces the full requirement set.
 */
export async function replaceRequirements(
  packId: string,
  reqs: Array<Omit<InsertRfpRequirement, "workItemId">>,
): Promise<RfpRequirement[]> {
  // Delete existing (cascade handles responses + blocks)
  await db
    .delete(rfpRequirementsTable)
    .where(eq(rfpRequirementsTable.workItemId, packId));

  if (!reqs.length) return [];

  const rows = await db
    .insert(rfpRequirementsTable)
    .values(reqs.map((r) => ({ ...r, workItemId: packId })))
    .returning();
  return rows;
}

export async function getRequirements(packId: string): Promise<RfpRequirement[]> {
  return db
    .select()
    .from(rfpRequirementsTable)
    .where(eq(rfpRequirementsTable.workItemId, packId))
    .orderBy(rfpRequirementsTable.displayOrder);
}

export async function getRequirement(reqId: string): Promise<RfpRequirement | null> {
  const [row] = await db
    .select()
    .from(rfpRequirementsTable)
    .where(eq(rfpRequirementsTable.id, reqId))
    .limit(1);
  return row ?? null;
}

export async function updateRequirement(
  reqId: string,
  data: Partial<InsertRfpRequirement>,
): Promise<RfpRequirement | null> {
  const [row] = await db
    .update(rfpRequirementsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rfpRequirementsTable.id, reqId))
    .returning();
  return row ?? null;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface ResponseWithBlocks {
  response: RfpResponse;
  blocks: RfpResponseBlock[];
}

/**
 * Upsert a response for a requirement.
 * If a response already exists for this requirement, returns the existing row
 * without modification (blocks are managed separately).
 * When replacing (re-generate), the caller must delete blocks first or use
 * replaceResponseBlocks.
 */
export async function upsertResponse(
  workItemId: string,
  requirementId: string,
  data: { status?: string; lens?: string; openDependencies?: string[] },
): Promise<RfpResponse> {
  const existing = await db
    .select()
    .from(rfpResponsesTable)
    .where(eq(rfpResponsesTable.requirementId, requirementId))
    .limit(1);

  if (existing.length) {
    const [row] = await db
      .update(rfpResponsesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rfpResponsesTable.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(rfpResponsesTable)
    .values({ workItemId, requirementId, ...data })
    .returning();
  return row;
}

export async function getResponseForRequirement(
  requirementId: string,
): Promise<ResponseWithBlocks | null> {
  const [response] = await db
    .select()
    .from(rfpResponsesTable)
    .where(eq(rfpResponsesTable.requirementId, requirementId))
    .limit(1);
  if (!response) return null;

  const blocks = await db
    .select()
    .from(rfpResponseBlocksTable)
    .where(eq(rfpResponseBlocksTable.responseId, response.id))
    .orderBy(rfpResponseBlocksTable.createdAt);

  return { response, blocks };
}

export async function getResponseById(
  responseId: string,
): Promise<ResponseWithBlocks | null> {
  const [response] = await db
    .select()
    .from(rfpResponsesTable)
    .where(eq(rfpResponsesTable.id, responseId))
    .limit(1);
  if (!response) return null;

  const blocks = await db
    .select()
    .from(rfpResponseBlocksTable)
    .where(eq(rfpResponseBlocksTable.responseId, response.id))
    .orderBy(rfpResponseBlocksTable.createdAt);

  return { response, blocks };
}

export async function updateResponse(
  responseId: string,
  data: Partial<Pick<RfpResponse, "status" | "lens" | "openDependencies">>,
): Promise<RfpResponse | null> {
  const [row] = await db
    .update(rfpResponsesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rfpResponsesTable.id, responseId))
    .returning();
  return row ?? null;
}

// ── Response blocks ────────────────────────────────────────────────────────────

/**
 * Replace all blocks for a response (used when re-generating).
 */
export async function replaceResponseBlocks(
  responseId: string,
  blocks: Array<Omit<InsertRfpResponseBlock, "responseId">>,
): Promise<RfpResponseBlock[]> {
  await db
    .delete(rfpResponseBlocksTable)
    .where(eq(rfpResponseBlocksTable.responseId, responseId));

  if (!blocks.length) return [];

  return db
    .insert(rfpResponseBlocksTable)
    .values(blocks.map((b) => ({ ...b, responseId })))
    .returning();
}

export async function upsertBlock(
  responseId: string,
  data: Omit<InsertRfpResponseBlock, "responseId">,
): Promise<RfpResponseBlock> {
  const existing = await db
    .select()
    .from(rfpResponseBlocksTable)
    .where(
      and(
        eq(rfpResponseBlocksTable.responseId, responseId),
        eq(rfpResponseBlocksTable.blockKey, data.blockKey),
      ),
    )
    .limit(1);

  if (existing.length) {
    const [row] = await db
      .update(rfpResponseBlocksTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rfpResponseBlocksTable.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(rfpResponseBlocksTable)
    .values({ ...data, responseId })
    .returning();
  return row;
}

export async function updateBlock(
  responseId: string,
  blockKey: string,
  data: Partial<Omit<InsertRfpResponseBlock, "responseId" | "blockKey">>,
): Promise<RfpResponseBlock | null> {
  const [row] = await db
    .update(rfpResponseBlocksTable)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(rfpResponseBlocksTable.responseId, responseId),
        eq(rfpResponseBlocksTable.blockKey, blockKey),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Quality reviews ────────────────────────────────────────────────────────────

export async function insertQualityReview(
  data: InsertRfpQualityReview,
): Promise<RfpQualityReview> {
  const [row] = await db
    .insert(rfpQualityReviewsTable)
    .values(data)
    .returning();
  return row;
}

export async function getQualityReviews(
  packId: string,
  filters?: { reviewType?: string; targetId?: string },
): Promise<RfpQualityReview[]> {
  const conditions = [eq(rfpQualityReviewsTable.workItemId, packId)];
  if (filters?.reviewType) {
    conditions.push(eq(rfpQualityReviewsTable.reviewType, filters.reviewType));
  }
  if (filters?.targetId) {
    conditions.push(eq(rfpQualityReviewsTable.targetId, filters.targetId));
  }
  return db
    .select()
    .from(rfpQualityReviewsTable)
    .where(and(...conditions))
    .orderBy(rfpQualityReviewsTable.createdAt);
}

export async function getLatestQualityReview(
  packId: string,
  reviewType: string,
  targetId?: string,
): Promise<RfpQualityReview | null> {
  const conditions = [
    eq(rfpQualityReviewsTable.workItemId, packId),
    eq(rfpQualityReviewsTable.reviewType, reviewType),
  ];
  if (targetId) {
    conditions.push(eq(rfpQualityReviewsTable.targetId, targetId));
  }
  const [row] = await db
    .select()
    .from(rfpQualityReviewsTable)
    .where(and(...conditions))
    .orderBy(desc(rfpQualityReviewsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function overrideQualityReview(
  id: string,
  overrideReason: string,
  overrideActor: string,
): Promise<RfpQualityReview | null> {
  const [row] = await db
    .update(rfpQualityReviewsTable)
    .set({ overridden: true, overrideReason, overrideActor })
    .where(eq(rfpQualityReviewsTable.id, id))
    .returning();
  return row ?? null;
}

// ── Audit events (append-only) ────────────────────────────────────────────────
// No update or delete method is exposed. Callers must use appendAuditEvent only.

export async function appendAuditEvent(
  data: InsertRfpAuditEvent,
): Promise<RfpAuditEvent> {
  const [row] = await db
    .insert(rfpAuditEventsTable)
    .values(data)
    .returning();
  return row;
}

export async function getAuditEvents(
  packId: string,
  requirementId?: string,
): Promise<RfpAuditEvent[]> {
  const conditions = [eq(rfpAuditEventsTable.workItemId, packId)];
  if (requirementId) {
    conditions.push(eq(rfpAuditEventsTable.requirementId, requirementId));
  }
  return db
    .select()
    .from(rfpAuditEventsTable)
    .where(and(...conditions))
    .orderBy(rfpAuditEventsTable.createdAt);
}

/**
 * Conversations repository — raw database access for conversations.
 * No business logic here; all access-control enforcement is in the service layer.
 */

import { db } from "@workspace/db";
import {
  conversationsTable,
  type Conversation,
  type InsertConversation,
} from "@workspace/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getConversation(
  id: string,
  organisationId: string,
): Promise<Conversation | null> {
  const [row] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, id),
        eq(conversationsTable.organisationId, organisationId),
      ),
    );
  return row ?? null;
}

export async function listConversations(
  organisationId: string,
  limit = 20,
): Promise<Conversation[]> {
  return db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.organisationId, organisationId),
        eq(conversationsTable.status, "active"),
      ),
    )
    .orderBy(desc(conversationsTable.lastMessageAt), desc(conversationsTable.createdAt))
    .limit(limit);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createConversation(
  data: InsertConversation,
): Promise<Conversation> {
  const [row] = await db
    .insert(conversationsTable)
    .values(data)
    .returning();
  return row;
}

export async function updateConversation(
  id: string,
  organisationId: string,
  data: Partial<Pick<Conversation, "title" | "activeLens" | "opportunityId" | "metadata">>,
): Promise<Conversation | null> {
  const [row] = await db
    .update(conversationsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(conversationsTable.id, id),
        eq(conversationsTable.organisationId, organisationId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function archiveConversation(
  id: string,
  organisationId: string,
): Promise<Conversation | null> {
  const [row] = await db
    .update(conversationsTable)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(conversationsTable.id, id),
        eq(conversationsTable.organisationId, organisationId),
        eq(conversationsTable.status, "active"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function touchLastMessageAt(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(conversationsTable)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(conversationsTable.id, id));
}

export async function unlinkOpportunity(
  id: string,
  organisationId: string,
): Promise<Conversation | null> {
  const [row] = await db
    .update(conversationsTable)
    .set({ opportunityId: null, updatedAt: new Date() })
    .where(
      and(
        eq(conversationsTable.id, id),
        eq(conversationsTable.organisationId, organisationId),
      ),
    )
    .returning();
  return row ?? null;
}

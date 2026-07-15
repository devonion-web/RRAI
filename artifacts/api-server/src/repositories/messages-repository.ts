/**
 * Messages repository — raw database access for conversation messages.
 * Status lifecycle: pending → streaming → complete | failed
 */

import { db } from "@workspace/db";
import {
  messagesTable,
  type Message,
  type InsertMessage,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getMessage(id: string): Promise<Message | null> {
  const [row] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.id, id));
  return row ?? null;
}

/**
 * Returns all non-failed messages in a conversation, oldest first.
 * The limit applies from the most-recent end so context-window assembly can
 * slice further if needed.
 */
export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<Message[]> {
  // Fetch most-recent `limit` rows, then reverse to chronological order
  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  return rows.reverse();
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createMessage(data: InsertMessage): Promise<Message> {
  const [row] = await db
    .insert(messagesTable)
    .values(data)
    .returning();
  return row;
}

/**
 * Append a text delta to an in-progress assistant message.
 * Called during SSE streaming to persist partial content.
 */
export async function appendMessageContent(
  id: string,
  additionalContent: string,
  status: "streaming" | "complete" = "streaming",
): Promise<void> {
  // Use raw SQL concat so we don't need to read the current value first
  await db.execute(sql`
    UPDATE messages
    SET content = content || ${additionalContent},
        status = ${status},
        updated_at = NOW()
    WHERE id = ${id}
  `);
}

/**
 * Set the final content and mark the message complete.
 * Used when we have the full content ready (non-streaming or post-stream).
 */
export async function finaliseMessage(
  id: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<Message | null> {
  const [row] = await db
    .update(messagesTable)
    .set({
      content,
      status: "complete",
      metadata: metadata ?? null,
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, id))
    .returning();
  return row ?? null;
}

export async function markMessageStreaming(id: string): Promise<void> {
  await db
    .update(messagesTable)
    .set({ status: "streaming", updatedAt: new Date() })
    .where(eq(messagesTable.id, id));
}

export async function markMessageFailed(
  id: string,
  errorMetadata: Record<string, unknown>,
): Promise<Message | null> {
  const [row] = await db
    .update(messagesTable)
    .set({ status: "failed", metadata: errorMetadata, updatedAt: new Date() })
    .where(eq(messagesTable.id, id))
    .returning();
  return row ?? null;
}

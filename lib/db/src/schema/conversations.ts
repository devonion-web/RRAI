/**
 * Conversations and Messages — Runtime Memory domain.
 *
 * Design principles:
 *  - Each conversation is scoped to one organisation.
 *  - Messages are owned by the conversation; cascade-delete on conversation removal.
 *  - The activeLens field persists the constitutional lens active when the message was sent.
 *  - Streaming messages are written as `pending`→`streaming`→`complete|failed`.
 *    A page refresh during generation will find the last persisted content and status.
 *  - Content is never duplicated into the audit_events table; audit records carry IDs only.
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organisationsTable, opportunitiesTable } from "./runtime";

// ── Typed constant definitions ────────────────────────────────────────────────
// These are the authoritative source for valid enum values in the system.
// Both server and client must import from here (or from generated Zod schemas).

export const CONVERSATION_LENSES = ["analyst", "intelligence", "commercial", "delivery"] as const;
export type ConversationLens = typeof CONVERSATION_LENSES[number];

export const CONVERSATION_TYPES = [
  "general",
  "opportunity",
  "research",
  "delivery",
  "rfp",
  "presentation",
  "document",
] as const;
export type ConversationType = typeof CONVERSATION_TYPES[number];

export const CONVERSATION_STATUSES = ["active", "archived"] as const;
export type ConversationStatus = typeof CONVERSATION_STATUSES[number];

export const MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = typeof MESSAGE_ROLES[number];

export const MESSAGE_STATUSES = ["pending", "streaming", "complete", "failed"] as const;
export type MessageStatus = typeof MESSAGE_STATUSES[number];

// ── Conversations ─────────────────────────────────────────────────────────────
// Runtime Memory — one conversation per thread. All messages belong to a conversation.
export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tenancy
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),
    ownerUserId: varchar("owner_user_id").references(() => usersTable.id),

    // Optional opportunity linkage
    opportunityId: uuid("opportunity_id").references(() => opportunitiesTable.id),

    // Content and classification
    title: text("title").notNull().default("New Conversation"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    conversationType: varchar("conversation_type", { length: 32 }).notNull().default("general"),
    activeLens: varchar("active_lens", { length: 32 }).notNull().default("analyst"),
    sensitivity: varchar("sensitivity", { length: 32 }).notNull().default("standard"),

    // Flexible metadata (not for business logic)
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // Timestamps
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("conversations_org_id_idx").on(table.organisationId),
    index("conversations_owner_user_id_idx").on(table.ownerUserId),
    index("conversations_opportunity_id_idx").on(table.opportunityId),
    index("conversations_status_idx").on(table.status),
    index("conversations_last_message_at_idx").on(table.lastMessageAt),
  ],
);

// ── Messages ──────────────────────────────────────────────────────────────────
// Each row is one turn in the conversation.
// content is written incrementally during streaming; status tracks generation lifecycle.
//
// Context-window management strategy (initial):
//   - Assemble up to CONTEXT_CHAR_BUDGET characters of recent message history.
//   - Always include the current user message.
//   - Always include the system prompt.
//   - Include linked opportunity summary where relevant.
//   - Exclude failed or system messages from model context by default.
//   - Budget is 60,000 characters (~15k tokens at ~4 chars/token).
//   - No automatic summarisation in this iteration; schema supports future summaryId column.
export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisationsTable.id),

    // Nullable for assistant/system messages
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id),

    // Message structure
    role: varchar("role", { length: 16 }).notNull(), // MessageRole
    content: text("content").notNull().default(""),
    contentType: varchar("content_type", { length: 32 }).notNull().default("text"),

    // AI metadata (null for user/system messages)
    model: varchar("model", { length: 128 }),
    activeLens: varchar("active_lens", { length: 32 }),

    // Generation lifecycle
    status: varchar("status", { length: 16 }).notNull().default("complete"),

    // Flexible metadata (token counts, finish reason, error codes — never raw secrets)
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_org_id_idx").on(table.organisationId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_status_idx").on(table.status),
  ],
);

// ── Insert/select type exports ─────────────────────────────────────────────────
export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = typeof conversationsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;

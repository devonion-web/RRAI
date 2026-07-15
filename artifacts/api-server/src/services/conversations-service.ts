/**
 * Conversations service — enforces authentication, organisation membership,
 * ownership, and opportunity access before delegating to repositories.
 *
 * Access rules:
 *  - Users may only see conversations in their own organisation.
 *  - Ownership is set at creation; the creator is the owner.
 *  - Opportunity linkage requires the opportunity to belong to the same org.
 *  - Lens changes are validated against the CONVERSATION_LENSES constant.
 *  - All mutations are recorded in audit_events. Message content is never logged there.
 */

import * as convsRepo from "../repositories/conversations-repository";
import * as msgsRepo from "../repositories/messages-repository";
import * as oppsRepo from "../repositories/opportunities-repository";
import { logAuditEvent } from "../repositories/audit-repository";
import {
  CONVERSATION_LENSES,
  CONVERSATION_TYPES,
  type ConversationLens,
  type ConversationType,
  type Conversation,
  type Message,
} from "@workspace/db/schema";

export type { ConversationLens, ConversationType };
export { CONVERSATION_LENSES, CONVERSATION_TYPES };

export interface ActorContext {
  userId: string;
  orgId: string;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function listConversations(actor: ActorContext, limit = 20) {
  return convsRepo.listConversations(actor.orgId, limit);
}

export async function createConversation(
  actor: ActorContext,
  data: {
    title?: string;
    conversationType?: ConversationType;
    activeLens?: ConversationLens;
    opportunityId?: string;
  },
): Promise<Conversation> {
  // Validate conversationType
  const conversationType = data.conversationType ?? "general";
  if (!CONVERSATION_TYPES.includes(conversationType)) {
    throw Object.assign(new Error(`Invalid conversation type: ${conversationType}`), { status: 400 });
  }

  // Validate lens
  const activeLens = data.activeLens ?? "analyst";
  if (!CONVERSATION_LENSES.includes(activeLens)) {
    throw Object.assign(new Error(`Invalid lens: ${activeLens}`), { status: 400 });
  }

  // Validate opportunity linkage if supplied
  if (data.opportunityId) {
    const opp = await oppsRepo.getOpportunity(data.opportunityId, actor.orgId);
    if (!opp) {
      throw Object.assign(new Error("Opportunity not found or not accessible"), { status: 404 });
    }
  }

  const conv = await convsRepo.createConversation({
    organisationId: actor.orgId,
    createdByUserId: actor.userId,
    ownerUserId: actor.userId,
    title: data.title?.trim() || "New Conversation",
    conversationType,
    activeLens,
    status: "active",
    opportunityId: data.opportunityId ?? null,
  });

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "conversation.created",
    entityType: "conversation",
    entityId: conv.id,
    payload: { conversationType, activeLens, opportunityId: data.opportunityId ?? null },
    lens: activeLens,
  });

  return conv;
}

export async function getConversation(
  actor: ActorContext,
  id: string,
): Promise<Conversation> {
  const conv = await convsRepo.getConversation(id, actor.orgId);
  if (!conv) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }
  return conv;
}

export async function updateTitle(
  actor: ActorContext,
  id: string,
  title: string,
): Promise<Conversation> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Title must not be empty"), { status: 400 });
  }
  const conv = await convsRepo.updateConversation(id, actor.orgId, { title: trimmed });
  if (!conv) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "conversation.renamed",
    entityType: "conversation",
    entityId: id,
    payload: { title: trimmed },
  });

  return conv;
}

export async function archiveConversation(
  actor: ActorContext,
  id: string,
): Promise<Conversation> {
  // Verify access first
  await getConversation(actor, id);

  const conv = await convsRepo.archiveConversation(id, actor.orgId);
  if (!conv) {
    throw Object.assign(new Error("Conversation not found or already archived"), { status: 404 });
  }

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "conversation.archived",
    entityType: "conversation",
    entityId: id,
  });

  return conv;
}

export async function linkOpportunity(
  actor: ActorContext,
  conversationId: string,
  opportunityId: string | null,
): Promise<Conversation> {
  // Verify conversation access
  await getConversation(actor, conversationId);

  if (opportunityId !== null) {
    const opp = await oppsRepo.getOpportunity(opportunityId, actor.orgId);
    if (!opp) {
      throw Object.assign(new Error("Opportunity not found or not accessible"), { status: 404 });
    }
  }

  const conv = await convsRepo.updateConversation(conversationId, actor.orgId, {
    opportunityId: opportunityId ?? undefined,
  });
  if (!conv) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: opportunityId ? "conversation.opportunity_linked" : "conversation.opportunity_unlinked",
    entityType: "conversation",
    entityId: conversationId,
    payload: { opportunityId },
  });

  return conv;
}

export async function changeLens(
  actor: ActorContext,
  conversationId: string,
  lens: ConversationLens,
): Promise<Conversation> {
  if (!CONVERSATION_LENSES.includes(lens)) {
    throw Object.assign(new Error(`Invalid lens: ${lens}`), { status: 400 });
  }

  // Verify conversation access
  await getConversation(actor, conversationId);

  const conv = await convsRepo.updateConversation(conversationId, actor.orgId, { activeLens: lens });
  if (!conv) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "conversation.lens_changed",
    entityType: "conversation",
    entityId: conversationId,
    payload: { lens },
    lens,
  });

  return conv;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listMessages(
  actor: ActorContext,
  conversationId: string,
): Promise<Message[]> {
  // Verify conversation access
  await getConversation(actor, conversationId);
  return msgsRepo.listMessages(conversationId);
}

export async function createUserMessage(
  actor: ActorContext,
  conversationId: string,
  content: string,
  activeLens: string,
): Promise<Message> {
  const msg = await msgsRepo.createMessage({
    conversationId,
    organisationId: actor.orgId,
    createdByUserId: actor.userId,
    role: "user",
    content,
    contentType: "text",
    status: "complete",
    activeLens,
  });

  await convsRepo.touchLastMessageAt(conversationId);
  return msg;
}

export async function createPendingAssistantMessage(
  conversationId: string,
  organisationId: string,
  model: string,
  activeLens: string,
): Promise<Message> {
  return msgsRepo.createMessage({
    conversationId,
    organisationId,
    role: "assistant",
    content: "",
    contentType: "text",
    status: "pending",
    model,
    activeLens,
  });
}

/**
 * Opportunities service — coordinates repository calls, access control,
 * and audit event recording. Routes must not bypass this layer for
 * mutating operations.
 *
 * Org context is always resolved from the server-authenticated session.
 * The client must never supply organisationId or userId.
 */

import * as oppsRepo from "../repositories/opportunities-repository";
import * as contactsRepo from "../repositories/contacts-repository";
import * as stateRepo from "../repositories/opportunity-state-repository";
import * as orgsRepo from "../repositories/organisations-repository";
import { logAuditEvent } from "../repositories/audit-repository";
import type { InsertOpportunity } from "@workspace/db/schema";

export interface ActorContext {
  userId: string;
  orgId: string;
}

// ── Organisation resolution ───────────────────────────────────────────────────

/**
 * Resolve the primary organisation for an authenticated user.
 * Returns the first active membership, or null if the user has none.
 */
export async function resolveUserOrg(userId: string): Promise<string | null> {
  const orgs = await orgsRepo.getUserOrgs(userId);
  return orgs[0]?.id ?? null;
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export async function listOpportunities(actor: ActorContext) {
  return oppsRepo.listOpportunities(actor.orgId);
}

export async function createOpportunity(
  actor: ActorContext,
  data: { company: string; name?: string },
) {
  const opp = await oppsRepo.createOpportunity({
    organisationId: actor.orgId,
    createdByUserId: actor.userId,
    ownerUserId: actor.userId,
    name: data.name ?? data.company,
    customerName: data.company,
    status: "active",
  } satisfies InsertOpportunity);

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "opportunity.created",
    entityType: "opportunity",
    entityId: opp.id,
    payload: { name: opp.name },
  });

  return opp;
}

export async function getOpportunity(actor: ActorContext, id: string) {
  return oppsRepo.getOpportunity(id, actor.orgId);
}

export async function updateOpportunity(
  actor: ActorContext,
  id: string,
  data: Partial<Pick<InsertOpportunity, "name" | "customerName" | "status" | "stage" | "summary" | "metadata">>,
) {
  const opp = await oppsRepo.updateOpportunity(id, actor.orgId, data);
  if (!opp) return null;

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "opportunity.updated",
    entityType: "opportunity",
    entityId: opp.id,
    payload: { fields: Object.keys(data) },
  });

  return opp;
}

export async function archiveOpportunity(actor: ActorContext, id: string) {
  const opp = await oppsRepo.archiveOpportunity(id, actor.orgId);
  if (!opp) return null;

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "opportunity.archived",
    entityType: "opportunity",
    entityId: opp.id,
    payload: {},
  });

  return opp;
}

export async function addEvent(
  actor: ActorContext,
  opportunityId: string,
  data: {
    type?: string;
    description?: string;
    stage?: string;
    output_snapshot?: Record<string, unknown>;
  },
) {
  const opp = await oppsRepo.getOpportunity(opportunityId, actor.orgId);
  if (!opp) return null;

  const event = await oppsRepo.createEvent({
    opportunityId,
    createdByUserId: actor.userId,
    type: data.type ?? "note",
    description: data.description ?? "",
    stage: data.stage ?? "pre_discovery",
    outputSnapshot: data.output_snapshot ?? null,
  });

  return event;
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listContacts(actor: ActorContext, opportunityId: string) {
  const opp = await oppsRepo.getOpportunity(opportunityId, actor.orgId);
  if (!opp) return null;
  return contactsRepo.listContacts(opportunityId, actor.orgId);
}

export async function saveContacts(
  actor: ActorContext,
  opportunityId: string | undefined,
  rawContacts: Record<string, unknown>[],
) {
  const results = [];
  for (const raw of rawContacts) {
    const data = contactsRepo.fromLegacyContact(raw, actor.orgId, opportunityId, actor.userId);
    const contact = await contactsRepo.createContact(data);

    await logAuditEvent({
      organisationId: actor.orgId,
      actorType: "user",
      actorId: actor.userId,
      eventType: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      payload: { opportunityId },
    });

    results.push(contact);
  }
  return results;
}

export async function updateContact(
  actor: ActorContext,
  id: string,
  data: Partial<import("@workspace/db/schema").InsertContact>,
) {
  const contact = await contactsRepo.updateContact(id, actor.orgId, data);
  if (!contact) return null;

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "contact.updated",
    entityType: "contact",
    entityId: contact.id,
    payload: { fields: Object.keys(data) },
  });

  return contact;
}

// ── Working state ─────────────────────────────────────────────────────────────

export async function getWorkingState(actor: ActorContext, opportunityId: string) {
  const opp = await oppsRepo.getOpportunity(opportunityId, actor.orgId);
  if (!opp) return null;
  return stateRepo.getWorkingState(opportunityId);
}

export async function upsertWorkingState(
  actor: ActorContext,
  opportunityId: string,
  payload: Record<string, unknown>,
) {
  const opp = await oppsRepo.getOpportunity(opportunityId, actor.orgId);
  if (!opp) return null;

  const state = await stateRepo.upsertWorkingState(opportunityId, payload, actor.userId);

  await logAuditEvent({
    organisationId: actor.orgId,
    actorType: "user",
    actorId: actor.userId,
    eventType: "opportunity.working_state_updated",
    entityType: "opportunity",
    entityId: opportunityId,
    payload: { stateType: stateRepo.LOGICGATE_STATE_TYPE },
  });

  return state;
}

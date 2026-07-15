import { db } from "@workspace/db";
import { auditEventsTable, type AuditEvent } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface AuditEventInput {
  organisationId?: string;
  actorType?: "user" | "system" | "agent";
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  lens?: string;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  await db.insert(auditEventsTable).values({
    organisationId: input.organisationId ?? null,
    actorType: input.actorType ?? "user",
    actorId: input.actorId ?? null,
    eventType: input.eventType,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload ?? null,
    lens: input.lens ?? null,
  });
}

export async function getAuditEventsForEntity(
  entityType: string,
  entityId: string,
): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEventsTable)
    .where(
      and(
        eq(auditEventsTable.entityType, entityType),
        eq(auditEventsTable.entityId, entityId),
      ),
    )
    .orderBy(desc(auditEventsTable.createdAt));
}

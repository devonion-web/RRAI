import { db } from "@workspace/db";
import {
  opportunitiesTable,
  opportunityEventsTable,
  type Opportunity,
  type InsertOpportunity,
  type OpportunityEvent,
  type InsertOpportunityEvent,
} from "@workspace/db/schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";

// ── Opportunities ─────────────────────────────────────────────────────────────

export async function listOpportunities(orgId: string): Promise<Opportunity[]> {
  return db
    .select()
    .from(opportunitiesTable)
    .where(
      and(
        eq(opportunitiesTable.organisationId, orgId),
        isNull(opportunitiesTable.archivedAt),
      ),
    )
    .orderBy(desc(opportunitiesTable.updatedAt));
}

export async function createOpportunity(data: InsertOpportunity): Promise<Opportunity> {
  const [row] = await db.insert(opportunitiesTable).values(data).returning();
  return row;
}

export async function getOpportunity(
  id: string,
  orgId: string,
): Promise<Opportunity | null> {
  const [row] = await db
    .select()
    .from(opportunitiesTable)
    .where(
      and(
        eq(opportunitiesTable.id, id),
        eq(opportunitiesTable.organisationId, orgId),
      ),
    );
  return row ?? null;
}

export async function updateOpportunity(
  id: string,
  orgId: string,
  data: Partial<InsertOpportunity>,
): Promise<Opportunity | null> {
  const [row] = await db
    .update(opportunitiesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(opportunitiesTable.id, id),
        eq(opportunitiesTable.organisationId, orgId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function archiveOpportunity(
  id: string,
  orgId: string,
): Promise<Opportunity | null> {
  const [row] = await db
    .update(opportunitiesTable)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(opportunitiesTable.id, id),
        eq(opportunitiesTable.organisationId, orgId),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Opportunity events ─────────────────────────────────────────────────────────

export async function listEvents(opportunityId: string): Promise<OpportunityEvent[]> {
  return db
    .select()
    .from(opportunityEventsTable)
    .where(eq(opportunityEventsTable.opportunityId, opportunityId))
    .orderBy(asc(opportunityEventsTable.createdAt));
}

export async function createEvent(data: InsertOpportunityEvent): Promise<OpportunityEvent> {
  const [row] = await db.insert(opportunityEventsTable).values(data).returning();
  return row;
}

// ── View helpers ───────────────────────────────────────────────────────────────
// Returns the opportunity in the shape expected by existing LogicGate clients.
// Maintains backward compatibility with the in-memory API shape.
export interface LegacyOpportunityView {
  opportunity_id: string;
  company: string;
  created_at: string;
  events: LegacyEventView[];
  contacts: LegacyContactRef[];
}

export interface LegacyEventView {
  id: string;
  type: string;
  description: string;
  stage: string;
  created_at: string;
  output_snapshot?: Record<string, unknown>;
}

export interface LegacyContactRef {
  id: string;
}

export function toLegacyView(
  opp: Opportunity,
  events: OpportunityEvent[],
  contactRefs: Array<{ id: string }>,
): LegacyOpportunityView {
  return {
    opportunity_id: opp.id,
    company: opp.customerName ?? opp.name,
    created_at: opp.createdAt.toISOString(),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      stage: e.stage ?? "pre_discovery",
      created_at: e.createdAt.toISOString(),
      output_snapshot: (e.outputSnapshot as Record<string, unknown>) ?? undefined,
    })),
    contacts: contactRefs,
  };
}

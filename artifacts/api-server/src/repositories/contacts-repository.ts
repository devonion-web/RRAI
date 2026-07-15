import { db } from "@workspace/db";
import {
  contactsTable,
  type Contact,
  type InsertContact,
} from "@workspace/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listContacts(
  opportunityId: string,
  orgId: string,
): Promise<Contact[]> {
  return db
    .select()
    .from(contactsTable)
    .where(
      and(
        eq(contactsTable.opportunityId, opportunityId),
        eq(contactsTable.organisationId, orgId),
        isNull(contactsTable.archivedAt),
      ),
    )
    .orderBy(asc(contactsTable.createdAt));
}

export async function createContact(data: InsertContact): Promise<Contact> {
  const [row] = await db.insert(contactsTable).values(data).returning();
  return row;
}

export async function getContact(id: string, orgId: string): Promise<Contact | null> {
  const [row] = await db
    .select()
    .from(contactsTable)
    .where(and(eq(contactsTable.id, id), eq(contactsTable.organisationId, orgId)));
  return row ?? null;
}

export async function updateContact(
  id: string,
  orgId: string,
  data: Partial<InsertContact>,
): Promise<Contact | null> {
  const [row] = await db
    .update(contactsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contactsTable.id, id), eq(contactsTable.organisationId, orgId)))
    .returning();
  return row ?? null;
}

export async function archiveContact(id: string, orgId: string): Promise<void> {
  await db
    .update(contactsTable)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contactsTable.id, id), eq(contactsTable.organisationId, orgId)));
}

// ── View helpers ───────────────────────────────────────────────────────────────
// Returns contacts in the shape the LogicGate frontend expects.
export interface LegacyContactView {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
  opportunity_id?: string;
  created_at: string;
  enriched?: Record<string, unknown>;
}

export function toLegacyContactView(c: Contact): LegacyContactView {
  const meta = (c.metadata ?? {}) as Record<string, unknown>;
  return {
    id: c.id,
    name: c.name,
    title: c.jobTitle ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    linkedin: c.linkedin ?? undefined,
    notes: c.notes ?? undefined,
    opportunity_id: c.opportunityId ?? undefined,
    created_at: c.createdAt.toISOString(),
    enriched: (meta.enriched as Record<string, unknown>) ?? undefined,
  };
}

export function fromLegacyContact(
  raw: Record<string, unknown>,
  orgId: string,
  opportunityId?: string,
  userId?: string,
): InsertContact {
  return {
    organisationId: orgId,
    opportunityId: opportunityId ?? null,
    createdByUserId: userId ?? null,
    name: String(raw.name ?? "Unknown"),
    email: raw.email ? String(raw.email) : null,
    jobTitle: raw.title ? String(raw.title) : null,
    company: raw.company ? String(raw.company) : null,
    phone: raw.phone ? String(raw.phone) : null,
    linkedin: raw.linkedin ? String(raw.linkedin) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadata: raw.enriched ? { enriched: raw.enriched } : null,
  };
}

import { db } from "@workspace/db";
import {
  organisationsTable,
  orgMembershipsTable,
  type Organisation,
  type InsertOrganisation,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export async function findOrCreateOrg(slug: string, name: string): Promise<Organisation> {
  const [existing] = await db
    .select()
    .from(organisationsTable)
    .where(eq(organisationsTable.slug, slug));
  if (existing) return existing;

  const [created] = await db
    .insert(organisationsTable)
    .values({ slug, name, status: "active" } satisfies InsertOrganisation)
    .returning();
  return created;
}

export async function getOrgBySlug(slug: string): Promise<Organisation | null> {
  const [row] = await db
    .select()
    .from(organisationsTable)
    .where(eq(organisationsTable.slug, slug));
  return row ?? null;
}

export async function getOrgById(id: string): Promise<Organisation | null> {
  const [row] = await db
    .select()
    .from(organisationsTable)
    .where(eq(organisationsTable.id, id));
  return row ?? null;
}

export async function getUserOrgs(userId: string): Promise<Organisation[]> {
  const rows = await db
    .select({ org: organisationsTable })
    .from(orgMembershipsTable)
    .innerJoin(organisationsTable, eq(orgMembershipsTable.organisationId, organisationsTable.id))
    .where(
      and(
        eq(orgMembershipsTable.userId, userId),
        eq(orgMembershipsTable.status, "active"),
      ),
    );
  return rows.map((r) => r.org);
}

export async function isMember(orgId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orgMembershipsTable.id })
    .from(orgMembershipsTable)
    .where(
      and(
        eq(orgMembershipsTable.organisationId, orgId),
        eq(orgMembershipsTable.userId, userId),
        eq(orgMembershipsTable.status, "active"),
      ),
    );
  return !!row;
}

export async function upsertMembership(
  orgId: string,
  userId: string,
  role: "member" | "admin" = "member",
): Promise<void> {
  await db
    .insert(orgMembershipsTable)
    .values({ organisationId: orgId, userId, role, status: "active" })
    .onConflictDoUpdate({
      target: [orgMembershipsTable.organisationId, orgMembershipsTable.userId],
      set: { role, status: "active", updatedAt: new Date() },
    });
}

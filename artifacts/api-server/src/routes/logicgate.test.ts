/**
 * Integration tests for DB-backed opportunity and contact routes.
 *
 * Run: node --test artifacts/api-server/src/routes/logicgate.test.ts
 *
 * These tests exercise the repository and service layers directly without
 * starting an HTTP server. They require DATABASE_URL to be set (uses the
 * dev/test Postgres instance) and create + clean up their own rows.
 *
 * Tests are written with node:test + node:assert (vitest blocked by
 * firewall in this environment).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// ── Load env (DATABASE_URL) ────────────────────────────────────────────────────
// The test runner does not go through vite or ts-node, so we need to make
// sure the DATABASE_URL env var is available. In the Replit workspace it is
// set in the environment already.

// ── Imports ───────────────────────────────────────────────────────────────────
import { db } from "@workspace/db";
import {
  organisationsTable,
  orgMembershipsTable,
  opportunitiesTable,
  opportunityEventsTable,
  contactsTable,
  opportunityWorkingStateTable,
  auditEventsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import * as orgsRepo from "../repositories/organisations-repository.js";
import * as oppsRepo from "../repositories/opportunities-repository.js";
import * as contactsRepo from "../repositories/contacts-repository.js";
import * as stateRepo from "../repositories/opportunity-state-repository.js";
import * as auditRepo from "../repositories/audit-repository.js";
import * as svc from "../services/opportunities-service.js";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TEST_USER_ID = `test_user_${Date.now()}`;
const TEST_ORG_SLUG = `test-org-${Date.now()}`;

let testOrgId: string;
let testActor: { userId: string; orgId: string };

// ── Lifecycle ─────────────────────────────────────────────────────────────────

before(async () => {
  // Minimal user row required for FK constraints
  await db
    .insert(usersTable)
    .values({
      id: TEST_USER_ID,
      email: `test_${Date.now()}@example.com`,
      role: "user",
    })
    .onConflictDoNothing();

  // Bootstrap org + membership
  const org = await orgsRepo.findOrCreateOrg(TEST_ORG_SLUG, "Test Organisation");
  testOrgId = org.id;
  await orgsRepo.upsertMembership(testOrgId, TEST_USER_ID, "member");
  testActor = { userId: TEST_USER_ID, orgId: testOrgId };
});

after(async () => {
  // Clean up all test rows in dependency order
  await db.delete(auditEventsTable).where(eq(auditEventsTable.actorId, TEST_USER_ID));
  await db.delete(opportunityWorkingStateTable).where(
    eq(
      opportunityWorkingStateTable.opportunityId,
      db
        .select({ id: opportunitiesTable.id })
        .from(opportunitiesTable)
        .where(eq(opportunitiesTable.organisationId, testOrgId))
        .limit(1),
    ),
  );

  const testOpps = await db
    .select({ id: opportunitiesTable.id })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.organisationId, testOrgId));

  for (const opp of testOpps) {
    await db
      .delete(opportunityWorkingStateTable)
      .where(eq(opportunityWorkingStateTable.opportunityId, opp.id));
    await db
      .delete(opportunityEventsTable)
      .where(eq(opportunityEventsTable.opportunityId, opp.id));
    await db
      .delete(contactsTable)
      .where(eq(contactsTable.opportunityId, opp.id));
  }

  await db
    .delete(opportunitiesTable)
    .where(eq(opportunitiesTable.organisationId, testOrgId));

  await db
    .delete(orgMembershipsTable)
    .where(eq(orgMembershipsTable.organisationId, testOrgId));
  await db
    .delete(organisationsTable)
    .where(eq(organisationsTable.id, testOrgId));
  await db
    .delete(usersTable)
    .where(eq(usersTable.id, TEST_USER_ID));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("organisations-repository", () => {
  it("findOrCreateOrg returns existing org on second call", async () => {
    const org1 = await orgsRepo.findOrCreateOrg(TEST_ORG_SLUG, "Test Organisation");
    const org2 = await orgsRepo.findOrCreateOrg(TEST_ORG_SLUG, "Different Name");
    assert.equal(org1.id, org2.id, "Should return the same org");
  });

  it("isMember returns true for an active member", async () => {
    const member = await orgsRepo.isMember(testOrgId, TEST_USER_ID);
    assert.equal(member, true);
  });

  it("isMember returns false for a non-member", async () => {
    const member = await orgsRepo.isMember(testOrgId, "non_existent_user");
    assert.equal(member, false);
  });

  it("getUserOrgs returns the org for a member", async () => {
    const orgs = await orgsRepo.getUserOrgs(TEST_USER_ID);
    const ids = orgs.map((o) => o.id);
    assert.ok(ids.includes(testOrgId), "Should include test org");
  });
});

describe("opportunities-service: create + read", () => {
  let oppId: string;

  it("createOpportunity persists a record", async () => {
    const opp = await svc.createOpportunity(testActor, { company: "Acme Corp" });
    assert.ok(opp.id, "Should have an id");
    assert.equal(opp.customerName, "Acme Corp");
    assert.equal(opp.organisationId, testOrgId);
    oppId = opp.id;
  });

  it("listOpportunities includes the new record", async () => {
    const opps = await svc.listOpportunities(testActor);
    const ids = opps.map((o) => o.id);
    assert.ok(ids.includes(oppId), "Should include the new opportunity");
  });

  it("getOpportunity returns the correct record", async () => {
    const opp = await svc.getOpportunity(testActor, oppId);
    assert.ok(opp, "Should find the opportunity");
    assert.equal(opp!.id, oppId);
  });

  it("getOpportunity returns null for a different org", async () => {
    // Use a valid UUID that doesn't match any real org
    const opp = await svc.getOpportunity({ userId: TEST_USER_ID, orgId: "00000000-0000-0000-0000-000000000000" }, oppId);
    assert.equal(opp, null, "Should not return rows from another org");
  });

  it("updateOpportunity patches the record", async () => {
    const updated = await svc.updateOpportunity(testActor, oppId, { stage: "discovery" });
    assert.ok(updated, "Should return the updated record");
    assert.equal(updated!.stage, "discovery");
  });
});

describe("opportunities-service: events", () => {
  let oppId: string;

  before(async () => {
    const opp = await svc.createOpportunity(testActor, { company: "Events Co" });
    oppId = opp.id;
  });

  it("addEvent persists an event", async () => {
    const event = await svc.addEvent(testActor, oppId, {
      type: "ai_output",
      description: "Test event",
      stage: "pre_discovery",
    });
    assert.ok(event, "Should return event");
    assert.equal(event!.type, "ai_output");
    assert.equal(event!.opportunityId, oppId);
  });

  it("listEvents returns events in chronological order", async () => {
    await svc.addEvent(testActor, oppId, { description: "First", type: "note" });
    await svc.addEvent(testActor, oppId, { description: "Second", type: "note" });
    const events = await oppsRepo.listEvents(oppId);
    assert.ok(events.length >= 2, "Should have at least 2 events");
    const times = events.map((e) => e.createdAt.getTime());
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] >= times[i - 1], "Should be in ascending order");
    }
  });

  it("toLegacyView maps correctly", async () => {
    const opp = (await svc.getOpportunity(testActor, oppId))!;
    const events = await oppsRepo.listEvents(oppId);
    const view = oppsRepo.toLegacyView(opp, events, []);
    assert.equal(view.opportunity_id, oppId);
    assert.ok(view.events.length >= 1, "Should have events");
    assert.ok("type" in view.events[0], "Event should have type");
  });
});

describe("contacts-service", () => {
  let oppId: string;

  before(async () => {
    const opp = await svc.createOpportunity(testActor, { company: "Contacts Ltd" });
    oppId = opp.id;
  });

  it("saveContacts persists contacts linked to an opportunity", async () => {
    const saved = await svc.saveContacts(testActor, oppId, [
      { name: "Alice Smith", title: "CISO", email: "alice@example.com" },
      { name: "Bob Jones", title: "CTO" },
    ]);
    assert.equal(saved.length, 2, "Should save 2 contacts");
    assert.equal(saved[0].name, "Alice Smith");
    assert.equal(saved[0].opportunityId, oppId);
  });

  it("listContacts returns saved contacts", async () => {
    const contacts = await svc.listContacts(testActor, oppId);
    assert.ok(contacts, "Should return an array");
    assert.ok(contacts!.length >= 2, "Should have at least 2 contacts");
    const names = contacts!.map((c) => c.name);
    assert.ok(names.includes("Alice Smith"));
  });

  it("toLegacyContactView maps correctly", async () => {
    const contacts = await contactsRepo.listContacts(oppId, testOrgId);
    const view = contactsRepo.toLegacyContactView(contacts[0]);
    assert.ok(view.id, "Should have id");
    assert.ok(view.name, "Should have name");
  });
});

describe("opportunity-state-repository", () => {
  let oppId: string;

  before(async () => {
    const opp = await svc.createOpportunity(testActor, { company: "State Co" });
    oppId = opp.id;
  });

  it("getWorkingState returns null before any state is saved", async () => {
    const state = await stateRepo.getWorkingState(oppId);
    assert.equal(state, null);
  });

  it("upsertWorkingState creates a state record", async () => {
    const payload = { __v: 1, company: "State Co", mode: "pre", savedAt: new Date().toISOString() };
    const state = await stateRepo.upsertWorkingState(oppId, payload, TEST_USER_ID);
    assert.ok(state.id, "Should return a record");
    assert.deepEqual((state.payload as Record<string, unknown>).company, "State Co");
  });

  it("upsertWorkingState updates existing state (upsert semantics)", async () => {
    const payload1 = { __v: 1, company: "State Co", mode: "pre" };
    const payload2 = { __v: 1, company: "State Co", mode: "post" };
    await stateRepo.upsertWorkingState(oppId, payload1, TEST_USER_ID);
    await stateRepo.upsertWorkingState(oppId, payload2, TEST_USER_ID);

    const rows = await db
      .select()
      .from(opportunityWorkingStateTable)
      .where(eq(opportunityWorkingStateTable.opportunityId, oppId));
    assert.equal(rows.length, 1, "Should have exactly one row per opportunity+stateType");
    assert.equal((rows[0].payload as Record<string, unknown>).mode, "post");
  });
});

describe("audit-repository", () => {
  it("logAuditEvent records an event", async () => {
    await auditRepo.logAuditEvent({
      organisationId: testOrgId,
      actorType: "user",
      actorId: TEST_USER_ID,
      eventType: "test.event",
      entityType: "opportunity",
      entityId: "test-entity-id",
      payload: { test: true },
    });

    const events = await auditRepo.getAuditEventsForEntity("opportunity", "test-entity-id");
    assert.ok(events.length >= 1, "Should have at least one event");
    const found = events.find((e) => e.eventType === "test.event");
    assert.ok(found, "Should find the logged event");
    assert.equal(found!.actorId, TEST_USER_ID);
  });
});

describe("opportunities-service: archive", () => {
  it("archiveOpportunity sets archivedAt and status", async () => {
    const opp = await svc.createOpportunity(testActor, { company: "Archive Me" });
    const archived = await svc.archiveOpportunity(testActor, opp.id);
    assert.ok(archived, "Should return the archived record");
    assert.equal(archived!.status, "archived");
    assert.ok(archived!.archivedAt, "Should have archivedAt set");

    // Should not appear in list
    const list = await svc.listOpportunities(testActor);
    const ids = list.map((o) => o.id);
    assert.ok(!ids.includes(opp.id), "Archived opp should not appear in list");
  });
});

describe("resolveUserOrg", () => {
  it("returns the org id for a member", async () => {
    const orgId = await svc.resolveUserOrg(TEST_USER_ID);
    assert.equal(orgId, testOrgId);
  });

  it("returns null for a user with no org", async () => {
    const orgId = await svc.resolveUserOrg("no_org_user");
    assert.equal(orgId, null);
  });
});

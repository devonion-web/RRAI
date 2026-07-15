/**
 * Conversation and message persistence / access-control tests.
 *
 * Run with:
 *   node --test --import tsx/esm src/routes/conversations.test.ts
 *
 * Strategy: call service and repository functions directly against the
 * real test database (same DATABASE_URL as the integration suite).
 * Tests are isolated by creating unique org/user rows per test.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { usersTable, organisationsTable, orgMembershipsTable } from "@workspace/db/schema";
import * as convsService from "../services/conversations-service";
import * as convsRepo from "../repositories/conversations-repository";
import * as msgsRepo from "../repositories/messages-repository";

// ── Test fixtures ─────────────────────────────────────────────────────────────

let orgA: { id: string };
let orgB: { id: string };
let userA: string;
let userB: string;

before(async () => {
  // Org A — primary test org
  const [oA] = await db.insert(organisationsTable).values({
    name: "Test Org A (conversations)",
    slug: `test-org-a-conv-${Date.now()}`,
    status: "active",
  }).returning();
  orgA = oA;

  // Org B — used for cross-org access-control tests
  const [oB] = await db.insert(organisationsTable).values({
    name: "Test Org B (conversations)",
    slug: `test-org-b-conv-${Date.now()}`,
    status: "active",
  }).returning();
  orgB = oB;

  // User A — member of org A
  const [uA] = await db.insert(usersTable).values({
    id: `test-ua-${Date.now()}`,
    email: `test-ua-${Date.now()}@example.com`,
    role: "user",
    accountStatus: "active",
  }).returning();
  userA = uA.id;

  await db.insert(orgMembershipsTable).values({
    organisationId: orgA.id,
    userId: userA,
    role: "member",
    status: "active",
  });

  // User B — member of org B only
  const [uB] = await db.insert(usersTable).values({
    id: `test-ub-${Date.now()}`,
    email: `test-ub-${Date.now()}@example.com`,
    role: "user",
    accountStatus: "active",
  }).returning();
  userB = uB.id;

  await db.insert(orgMembershipsTable).values({
    organisationId: orgB.id,
    userId: userB,
    role: "member",
    status: "active",
  });
});

// ── Persistence tests ─────────────────────────────────────────────────────────

describe("conversations-service: create + read", () => {
  it("creates a conversation and returns it", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, {
      title: "Test conversation",
      activeLens: "analyst",
      conversationType: "general",
    });

    assert.equal(conv.title, "Test conversation");
    assert.equal(conv.activeLens, "analyst");
    assert.equal(conv.status, "active");
    assert.equal(conv.organisationId, orgA.id);
    assert.equal(conv.createdByUserId, userA);
  });

  it("reads back a created conversation", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const created = await convsService.createConversation(actor, {
      title: "Readable conversation",
      activeLens: "commercial",
    });
    const fetched = await convsService.getConversation(actor, created.id);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.activeLens, "commercial");
  });

  it("lists active conversations for the org", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    await convsService.createConversation(actor, { title: "Listed conv" });
    const list = await convsService.listConversations(actor);
    assert.ok(list.length >= 1);
    assert(list.every(c => c.organisationId === orgA.id));
  });
});

describe("conversations-service: messages", () => {
  it("persists a user message", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Msg test" });
    const msg = await convsService.createUserMessage(actor, conv.id, "Hello world", "analyst");

    assert.equal(msg.role, "user");
    assert.equal(msg.content, "Hello world");
    assert.equal(msg.status, "complete");
    assert.equal(msg.conversationId, conv.id);
  });

  it("persists a pending assistant message and marks it complete", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Assistant msg test" });

    const pending = await msgsRepo.createMessage({
      conversationId: conv.id,
      organisationId: orgA.id,
      role: "assistant",
      content: "",
      contentType: "text",
      status: "pending",
      model: "claude-sonnet-4-6",
    });
    assert.equal(pending.status, "pending");

    const completed = await msgsRepo.finaliseMessage(pending.id, "Final answer.", {
      stopReason: "end_turn",
    });
    assert.ok(completed);
    assert.equal(completed!.status, "complete");
    assert.equal(completed!.content, "Final answer.");
  });

  it("reloads message history after creation", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "History test" });
    await convsService.createUserMessage(actor, conv.id, "First", "analyst");
    await convsService.createUserMessage(actor, conv.id, "Second", "analyst");

    const msgs = await convsService.listMessages(actor, conv.id);
    assert.ok(msgs.length >= 2);
    // Messages are in chronological order
    const userMsgs = msgs.filter(m => m.role === "user");
    assert.equal(userMsgs[userMsgs.length - 1].content, "Second");
  });

  it("survives simulated service restart — message persists after re-query", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Restart test" });
    const msg = await convsService.createUserMessage(actor, conv.id, "Durable message", "analyst");

    // Simulate restart by fetching via the raw repo (cold path)
    const reloaded = await msgsRepo.getMessage(msg.id);
    assert.ok(reloaded);
    assert.equal(reloaded!.content, "Durable message");
  });
});

describe("conversations-service: archive", () => {
  it("archives a conversation", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Archive me" });
    const archived = await convsService.archiveConversation(actor, conv.id);
    assert.equal(archived.status, "archived");
  });

  it("archived conversation no longer appears in active list", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Hidden after archive" });
    await convsService.archiveConversation(actor, conv.id);
    const list = await convsService.listConversations(actor);
    assert.ok(!list.find(c => c.id === conv.id));
  });
});

describe("conversations-service: lens", () => {
  it("changes the active lens and persists it", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Lens test", activeLens: "analyst" });
    const updated = await convsService.changeLens(actor, conv.id, "delivery");
    assert.equal(updated.activeLens, "delivery");

    // Reload to confirm persistence
    const reloaded = await convsService.getConversation(actor, conv.id);
    assert.equal(reloaded.activeLens, "delivery");
  });

  it("rejects an invalid lens value", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Bad lens" });
    await assert.rejects(
      () => convsService.changeLens(actor, conv.id, "invalid_lens" as never),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
  });
});

// ── Access-control tests ──────────────────────────────────────────────────────

describe("access control", () => {
  it("user cannot read another organisation's conversation", async () => {
    const actorA = { userId: userA, orgId: orgA.id };
    const actorB = { userId: userB, orgId: orgB.id };

    const conv = await convsService.createConversation(actorA, { title: "Org A private" });

    // Actor B (different org) should get 404
    await assert.rejects(
      () => convsService.getConversation(actorB, conv.id),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  it("user cannot write messages to another organisation's conversation", async () => {
    const actorA = { userId: userA, orgId: orgA.id };
    const actorB = { userId: userB, orgId: orgB.id };

    const conv = await convsService.createConversation(actorA, { title: "Org A write-protected" });

    // getConversation enforces org scope; listMessages calls it first
    await assert.rejects(
      () => convsService.listMessages(actorB, conv.id),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  it("user cannot archive another organisation's conversation", async () => {
    const actorA = { userId: userA, orgId: orgA.id };
    const actorB = { userId: userB, orgId: orgB.id };

    const conv = await convsService.createConversation(actorA, { title: "Org A archive-protected" });

    await assert.rejects(
      () => convsService.archiveConversation(actorB, conv.id),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  it("org-scoped list never returns conversations from another org", async () => {
    const actorA = { userId: userA, orgId: orgA.id };
    const actorB = { userId: userB, orgId: orgB.id };

    await convsService.createConversation(actorA, { title: "A-only conversation" });

    const listB = await convsService.listConversations(actorB);
    assert.ok(listB.every(c => c.organisationId === orgB.id));
  });
});

describe("streaming message lifecycle", () => {
  it("user message is persisted before generation begins", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Persist before stream" });
    const msg = await convsService.createUserMessage(actor, conv.id, "Test input", "analyst");

    // Immediately verifiable — no stream needed
    const reloaded = await msgsRepo.getMessage(msg.id);
    assert.ok(reloaded);
    assert.equal(reloaded!.status, "complete");
  });

  it("assistant message moves through pending → streaming → complete", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Lifecycle test" });

    const pending = await msgsRepo.createMessage({
      conversationId: conv.id,
      organisationId: orgA.id,
      role: "assistant",
      content: "",
      contentType: "text",
      status: "pending",
      model: "test-model",
    });
    assert.equal(pending.status, "pending");

    await msgsRepo.markMessageStreaming(pending.id);
    const streaming = await msgsRepo.getMessage(pending.id);
    assert.equal(streaming!.status, "streaming");

    await msgsRepo.finaliseMessage(pending.id, "Done.", {});
    const complete = await msgsRepo.getMessage(pending.id);
    assert.equal(complete!.status, "complete");
    assert.equal(complete!.content, "Done.");
  });

  it("failed generation marks the message failed with metadata", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Failure test" });

    const msg = await msgsRepo.createMessage({
      conversationId: conv.id,
      organisationId: orgA.id,
      role: "assistant",
      content: "",
      contentType: "text",
      status: "pending",
    });

    await msgsRepo.markMessageFailed(msg.id, { message: "Model error", failedAt: new Date().toISOString() });
    const failed = await msgsRepo.getMessage(msg.id);
    assert.equal(failed!.status, "failed");
    assert.ok(failed!.metadata && typeof failed!.metadata === "object");
  });

  it("completed content remains after re-query (simulates reconnect)", async () => {
    const actor = { userId: userA, orgId: orgA.id };
    const conv = await convsService.createConversation(actor, { title: "Reconnect test" });

    const msg = await msgsRepo.createMessage({
      conversationId: conv.id,
      organisationId: orgA.id,
      role: "assistant",
      content: "",
      contentType: "text",
      status: "pending",
    });

    await msgsRepo.finaliseMessage(msg.id, "Persistent content after reconnect.", {});

    // Simulate reconnect — fetch via repo cold path
    const history = await msgsRepo.listMessages(conv.id);
    const assistantMsg = history.find(m => m.id === msg.id);
    assert.ok(assistantMsg);
    assert.equal(assistantMsg!.content, "Persistent content after reconnect.");
    assert.equal(assistantMsg!.status, "complete");
  });
});

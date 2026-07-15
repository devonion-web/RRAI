import { db } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  developmentTasksTable,
  aiRunsTable,
  reviewFindingsTable,
  changeProposalsTable,
  approvalsTable,
  repositoryReferencesTable,
  learningOutcomesTable,
  developmentAuditEventsTable,
  type DevelopmentTask,
  type InsertDevelopmentTask,
  type ReviewFinding,
  type InsertReviewFinding,
  type Approval,
  type InsertApproval,
} from "@workspace/db";

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<DevelopmentTask[]> {
  return db
    .select()
    .from(developmentTasksTable)
    .orderBy(desc(developmentTasksTable.createdAt));
}

export async function getTask(id: string): Promise<DevelopmentTask | undefined> {
  const rows = await db
    .select()
    .from(developmentTasksTable)
    .where(eq(developmentTasksTable.id, id));
  return rows[0];
}

export async function createTask(data: InsertDevelopmentTask): Promise<DevelopmentTask> {
  const rows = await db.insert(developmentTasksTable).values(data).returning();
  return rows[0];
}

export async function updateTaskStatus(
  id: string,
  status: string,
): Promise<DevelopmentTask | undefined> {
  const rows = await db
    .update(developmentTasksTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(developmentTasksTable.id, id))
    .returning();
  return rows[0];
}

// ── Task detail (all related entities in one call) ────────────────────────────

export async function getTaskDetail(id: string) {
  const task = await getTask(id);
  if (!task) return undefined;

  const [runs, findings, proposals, approvals, refs, outcomes] = await Promise.all([
    db
      .select()
      .from(aiRunsTable)
      .where(eq(aiRunsTable.developmentTaskId, id))
      .orderBy(desc(aiRunsTable.createdAt)),
    db
      .select()
      .from(reviewFindingsTable)
      .where(eq(reviewFindingsTable.developmentTaskId, id))
      .orderBy(desc(reviewFindingsTable.createdAt)),
    db
      .select()
      .from(changeProposalsTable)
      .where(eq(changeProposalsTable.developmentTaskId, id))
      .orderBy(desc(changeProposalsTable.createdAt)),
    db
      .select()
      .from(approvalsTable)
      .where(eq(approvalsTable.developmentTaskId, id))
      .orderBy(desc(approvalsTable.decidedAt)),
    db
      .select()
      .from(repositoryReferencesTable)
      .where(eq(repositoryReferencesTable.developmentTaskId, id)),
    db
      .select()
      .from(learningOutcomesTable)
      .where(eq(learningOutcomesTable.developmentTaskId, id))
      .orderBy(desc(learningOutcomesTable.createdAt)),
  ]);

  return { task, runs, findings, proposals, approvals, repositoryReferences: refs, learningOutcomes: outcomes };
}

// ── Review findings ───────────────────────────────────────────────────────────

export async function createReviewFinding(data: InsertReviewFinding): Promise<ReviewFinding> {
  const rows = await db.insert(reviewFindingsTable).values(data).returning();
  return rows[0];
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export async function createApproval(data: InsertApproval): Promise<Approval> {
  const rows = await db.insert(approvalsTable).values(data).returning();
  return rows[0];
}

// ── Activity timeline ─────────────────────────────────────────────────────────

export type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  taskId?: string | null;
  actorLabel?: string;
};

/**
 * Returns a merged, timestamp-sorted activity feed from development tasks and
 * audit events. Newest events first. Used by the Development Workspace dashboard.
 */
export async function listActivity(limit = 30): Promise<ActivityEvent[]> {
  const [tasks, auditRows] = await Promise.all([
    db
      .select()
      .from(developmentTasksTable)
      .orderBy(desc(developmentTasksTable.updatedAt))
      .limit(20),
    db
      .select()
      .from(developmentAuditEventsTable)
      .orderBy(desc(developmentAuditEventsTable.createdAt))
      .limit(limit),
  ]);

  const taskEvents: ActivityEvent[] = tasks.map((t) => ({
    id: `task-${t.id}`,
    type: t.status === "proposed" ? "task_created" : "task_updated",
    title: t.title,
    description: `Status: ${t.status.replace(/_/g, " ")}`,
    timestamp: (t.updatedAt ?? t.createdAt).toISOString(),
    taskId: t.id,
  }));

  const auditEvents: ActivityEvent[] = auditRows.map((e) => ({
    id: `audit-${e.id}`,
    type: e.eventType,
    title: `${e.entityType.replace(/_/g, " ")} — ${e.eventType.replace(/_/g, " ")}`,
    description: e.actorLabel ?? "system",
    timestamp: e.createdAt.toISOString(),
    taskId: e.developmentTaskId ?? null,
    actorLabel: e.actorLabel ?? undefined,
  }));

  return [...taskEvents, ...auditEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ── Audit events (append-only — no update/delete functions are exposed) ───────

export async function appendAuditEvent(event: {
  developmentTaskId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  actorType: string;
  actorLabel?: string;
  payload?: unknown;
}): Promise<void> {
  await db.insert(developmentAuditEventsTable).values({
    developmentTaskId: event.developmentTaskId ?? null,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    actorType: event.actorType,
    actorLabel: event.actorLabel ?? "system",
    payload: (event.payload ?? null) as Record<string, unknown> | null,
  });
}

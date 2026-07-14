import {
  type InsertDevelopmentTask,
  type InsertReviewFinding,
  type InsertApproval,
  type DevelopmentTask,
  type ReviewFinding,
  type Approval,
} from "@workspace/db";
import * as repo from "./developmentRepository.js";

// ── Valid status transitions ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ["approved_to_start", "archived"],
  approved_to_start: ["drafting", "archived"],
  drafting: ["under_review", "archived"],
  under_review: ["refinement_required", "awaiting_human_approval", "archived"],
  refinement_required: ["drafting", "archived"],
  awaiting_human_approval: ["approved", "rejected"],
  approved: ["ready_for_implementation", "archived"],
  rejected: ["archived"],
  ready_for_implementation: ["implemented", "archived"],
  implemented: ["verified", "archived"],
  verified: ["released", "archived"],
  released: ["archived"],
  archived: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function validNextStatuses(current: string): string[] {
  return VALID_TRANSITIONS[current] ?? [];
}

// ── Task creation ─────────────────────────────────────────────────────────────

export async function createTask(data: InsertDevelopmentTask): Promise<DevelopmentTask> {
  const task = await repo.createTask(data);
  await repo.appendAuditEvent({
    developmentTaskId: task.id,
    entityType: "development_task",
    entityId: task.id,
    eventType: "task.created",
    actorType: "system",
    actorLabel: "api",
    payload: { title: task.title, taskType: task.taskType, status: task.status },
  });
  return task;
}

// ── Status transition ─────────────────────────────────────────────────────────

export async function transitionStatus(
  taskId: string,
  toStatus: string,
): Promise<{ ok: boolean; error?: string; task?: DevelopmentTask }> {
  const task = await repo.getTask(taskId);
  if (!task) return { ok: false, error: "Task not found" };
  if (!isValidTransition(task.status, toStatus)) {
    return {
      ok: false,
      error: `Invalid transition: ${task.status} → ${toStatus}`,
    };
  }
  const updated = await repo.updateTaskStatus(taskId, toStatus);
  if (!updated) return { ok: false, error: "Update failed" };
  await repo.appendAuditEvent({
    developmentTaskId: taskId,
    entityType: "development_task",
    entityId: taskId,
    eventType: "task.status_changed",
    actorType: "system",
    actorLabel: "api",
    payload: { from: task.status, to: toStatus },
  });
  return { ok: true, task: updated };
}

// ── Review finding ────────────────────────────────────────────────────────────

export async function recordFinding(data: InsertReviewFinding): Promise<ReviewFinding> {
  const finding = await repo.createReviewFinding(data);
  await repo.appendAuditEvent({
    developmentTaskId: data.developmentTaskId,
    entityType: "review_finding",
    entityId: finding.id,
    eventType: "finding.recorded",
    actorType: "system",
    actorLabel: data.reviewerRole,
    payload: { severity: data.severity, category: data.category },
  });
  return finding;
}

// ── Approval ──────────────────────────────────────────────────────────────────
// Note: No model may approve its own work. This layer records what it receives;
// caller identity enforcement belongs to the auth layer (future phase).

export async function recordApproval(data: InsertApproval): Promise<Approval> {
  const approval = await repo.createApproval(data);
  await repo.appendAuditEvent({
    developmentTaskId: data.developmentTaskId,
    entityType: "approval",
    entityId: approval.id,
    eventType: `approval.${data.decision}`,
    actorType: "human",
    actorLabel: data.decidedByLabel ?? "human",
    payload: {
      approvalClass: data.approvalClass,
      decision: data.decision,
      reason: data.decisionReason,
    },
  });

  // Advance task status automatically on key approval decisions
  if (data.decision === "approved") {
    const task = await repo.getTask(data.developmentTaskId);
    if (task?.status === "proposed" && data.approvalClass === "architecture_change") {
      await transitionStatus(data.developmentTaskId, "approved_to_start");
    } else if (task?.status === "awaiting_human_approval") {
      await transitionStatus(data.developmentTaskId, "approved");
    }
  }

  return approval;
}

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  insertDevelopmentTaskSchema,
  insertReviewFindingSchema,
  insertApprovalSchema,
} from "@workspace/db";
import * as service from "../lib/developmentService.js";
import * as repo from "../lib/developmentRepository.js";
import { requireRole, getAuthenticatedUser } from "../middlewares/routeAuth";

const router: IRouter = Router();

// All /development/* routes require the "admin" role.
// 401 for unauthenticated requests, 403 for non-admins.
router.use("/development{/*splat}", requireRole("admin"));

// Path to the generated platform-status.json (written by generate:platform-status).
// process.cwd() = artifacts/api-server when run via pnpm filter.
const PLATFORM_STATUS_JSON = resolve(
  process.cwd(),
  "../../implementation/platform-status.json"
);

// GET /api/development/platform-status
// Read-only. Returns the latest generated platform status snapshot.
router.get("/development/platform-status", async (req: Request, res: Response): Promise<void> => {
  if (!existsSync(PLATFORM_STATUS_JSON)) {
    res.status(503).json({
      error: "Platform status not yet generated.",
      instructions:
        "Run: pnpm --filter @workspace/scripts run generate:platform-status",
    });
    return;
  }
  try {
    const data: unknown = JSON.parse(readFileSync(PLATFORM_STATUS_JSON, "utf8"));
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to read platform-status.json");
    res.status(500).json({ error: "Failed to read platform status" });
  }
});

// GET /api/development/activity
// Read-only. Returns a merged, newest-first activity timeline.
router.get("/development/activity", async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await repo.listActivity();
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Failed to list development activity");
    res.status(500).json({ error: "Failed to list activity", events: [] });
  }
});

// GET /api/development/tasks
router.get("/development/tasks", async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await repo.listTasks();
    res.json({ tasks });
  } catch (err) {
    req.log.error({ err }, "Failed to list development tasks");
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

// POST /api/development/tasks
router.post("/development/tasks", async (req: Request, res: Response): Promise<void> => {
  const parsed = insertDevelopmentTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  try {
    const task = await service.createTask(parsed.data);
    res.status(201).json({ task });
  } catch (err) {
    req.log.error({ err }, "Failed to create development task");
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET /api/development/tasks/:id
router.get("/development/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const detail = await repo.getTaskDetail(id);
    if (!detail) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get task detail");
    res.status(500).json({ error: "Failed to get task" });
  }
});

// POST /api/development/tasks/:id/findings
router.post("/development/tasks/:id/findings", async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = insertReviewFindingSchema.safeParse({
    ...req.body,
    developmentTaskId: id,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  try {
    const finding = await service.recordFinding(parsed.data);
    res.status(201).json({ finding });
  } catch (err) {
    req.log.error({ err }, "Failed to record finding");
    res.status(500).json({ error: "Failed to record finding" });
  }
});

// POST /api/development/tasks/:id/approvals
// decidedBy and decidedByLabel are sourced from the authenticated session —
// the client cannot supply or override them.
router.post("/development/tasks/:id/approvals", async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = getAuthenticatedUser(req);

  // Strip any client-supplied identity fields; inject from the authenticated session.
  const { decidedBy: _stripDecidedBy, decidedByLabel: _stripLabel, ...safeBody } = req.body;

  const parsed = insertApprovalSchema.safeParse({
    ...safeBody,
    developmentTaskId: id,
    decidedByLabel: user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id
      : "admin",
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  try {
    const approval = await service.recordApproval(parsed.data);
    res.status(201).json({ approval });
  } catch (err) {
    req.log.error({ err }, "Failed to record approval");
    res.status(500).json({ error: "Failed to record approval" });
  }
});

export default router;

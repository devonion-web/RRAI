import { Router, type IRouter, type Request, type Response } from "express";
import {
  insertDevelopmentTaskSchema,
  insertReviewFindingSchema,
  insertApprovalSchema,
} from "@workspace/db";
import * as service from "../lib/developmentService.js";
import * as repo from "../lib/developmentRepository.js";

const router: IRouter = Router();

// GET /api/development/tasks
router.get("/development/tasks", async (req: Request, res: Response) => {
  try {
    const tasks = await repo.listTasks();
    res.json({ tasks });
  } catch (err) {
    req.log.error({ err }, "Failed to list development tasks");
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

// POST /api/development/tasks
router.post("/development/tasks", async (req: Request, res: Response) => {
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
router.get("/development/tasks/:id", async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
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
router.post("/development/tasks/:id/findings", async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
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
router.post("/development/tasks/:id/approvals", async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
  const parsed = insertApprovalSchema.safeParse({
    ...req.body,
    developmentTaskId: id,
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

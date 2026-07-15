/**
 * Conversation routes — authenticated endpoints for conversations and messages.
 *
 * All routes require an authenticated session (requireAuthenticatedUser middleware).
 * The actor context is resolved server-side; client must never supply userId or orgId.
 *
 * POST /conversations/:id/messages streams the assistant response as SSE.
 * All other endpoints return standard JSON.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthenticatedUser, getAuthenticatedUser } from "../middlewares/routeAuth";
import * as convsService from "../services/conversations-service";
import * as assistantService from "../services/assistant-service";
import * as opportunitiesService from "../services/opportunities-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All conversation routes require an authenticated session
router.use("/conversations{/*splat}", requireAuthenticatedUser);

// ─── Express 5 params helper ──────────────────────────────────────────────────
// In Express 5, params may be string | string[] at the type level.
function paramId(req: Request): string {
  const raw = req.params["id"];
  return String(Array.isArray(raw) ? raw[0] : raw ?? "");
}

// ─── Actor context helper ─────────────────────────────────────────────────────

async function resolveActor(
  req: Request,
  res: Response,
): Promise<{ userId: string; orgId: string } | null> {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorised" });
    return null;
  }
  const orgId = await opportunitiesService.resolveUserOrg(user.id);
  if (!orgId) {
    res.status(403).json({ error: "No organisation membership — contact your administrator" });
    return null;
  }
  return { userId: user.id, orgId };
}

// ─── Error handler ────────────────────────────────────────────────────────────

function handleServiceError(res: Response, err: unknown): void {
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    if (status === 400) { res.status(400).json({ error: err.message }); return; }
    if (status === 403) { res.status(403).json({ error: err.message }); return; }
    if (status === 404) { res.status(404).json({ error: err.message }); return; }
  }
  logger.error({ err }, "conversations route: unexpected error");
  res.status(500).json({ error: "Internal server error" });
}

// ─── GET /conversations — list recent conversations ───────────────────────────

router.get("/conversations", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const conversations = await convsService.listConversations(actor);
    res.json({ conversations });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── POST /conversations — create a conversation ──────────────────────────────

router.post("/conversations", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const { title, conversationType, activeLens, opportunityId } = req.body as Record<string, unknown>;
    const conv = await convsService.createConversation(actor, {
      title: typeof title === "string" ? title : undefined,
      conversationType: typeof conversationType === "string" ? conversationType as convsService.ConversationType : undefined,
      activeLens: typeof activeLens === "string" ? activeLens as convsService.ConversationLens : undefined,
      opportunityId: typeof opportunityId === "string" ? opportunityId : undefined,
    });
    res.status(201).json({ conversation: conv });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /conversations/:id — read a conversation ────────────────────────────

router.get("/conversations/:id", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const conv = await convsService.getConversation(actor, paramId(req));
    res.json({ conversation: conv });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── PATCH /conversations/:id — update title ─────────────────────────────────

router.patch("/conversations/:id", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const { title } = req.body as Record<string, unknown>;
    if (typeof title !== "string") {
      res.status(400).json({ error: "title must be a string" });
      return;
    }
    const conv = await convsService.updateTitle(actor, paramId(req), title);
    res.json({ conversation: conv });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── POST /conversations/:id/archive — archive ────────────────────────────────

router.post("/conversations/:id/archive", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const conv = await convsService.archiveConversation(actor, paramId(req));
    res.json({ archived: true, id: conv.id });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── PUT /conversations/:id/opportunity — link or unlink opportunity ──────────

router.put("/conversations/:id/opportunity", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const { opportunityId } = req.body as Record<string, unknown>;
    const oppId = opportunityId === null ? null : typeof opportunityId === "string" ? opportunityId : undefined;
    if (oppId === undefined) {
      res.status(400).json({ error: "opportunityId must be a string or null" });
      return;
    }
    const conv = await convsService.linkOpportunity(actor, paramId(req), oppId);
    res.json({ conversation: conv });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── PUT /conversations/:id/lens — change active lens ────────────────────────

router.put("/conversations/:id/lens", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const { lens } = req.body as Record<string, unknown>;
    if (typeof lens !== "string") {
      res.status(400).json({ error: "lens must be a string" });
      return;
    }
    const conv = await convsService.changeLens(actor, paramId(req), lens as convsService.ConversationLens);
    res.json({ conversation: conv });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /conversations/:id/messages — list messages ─────────────────────────

router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  try {
    const messages = await convsService.listMessages(actor, paramId(req));
    res.json({ messages });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── POST /conversations/:id/messages — send message + stream response ────────
//
// Streams the assistant response as SSE. The client should listen with
// EventSource or fetch+ReadableStream.
//
// SSE event format:
//   data: {"pending":true,"messageId":"<id>"}   — assistant message created
//   data: {"delta":"<text>"}                     — streaming text chunk
//   data: {"done":true,"messageId":"<id>"}       — generation complete
//   data: {"error":"<message>","messageId":"<id>"} — generation failed

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  const { content } = req.body as Record<string, unknown>;
  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content must be a non-empty string" });
    return;
  }

  let conv: Awaited<ReturnType<typeof convsService.getConversation>>;
  try {
    conv = await convsService.getConversation(actor, paramId(req));
  } catch (err) {
    handleServiceError(res, err);
    return;
  }

  if (conv.status === "archived") {
    res.status(400).json({ error: "Cannot send messages to an archived conversation" });
    return;
  }

  // Persist user message first (before opening SSE — ensures durability)
  const userMsg = await convsService.createUserMessage(
    actor,
    conv.id,
    content.trim(),
    conv.activeLens ?? "analyst",
  );

  // ── SSE headers ──
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Keepalive ping every 15 s to prevent proxy timeout
  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15_000);

  res.on("close", () => clearInterval(keepalive));

  try {
    await assistantService.streamAssistantResponse({
      actor,
      conversation: conv,
      userContent: userMsg.content,
      res,
    });
  } catch (err) {
    logger.error({ err }, "conversations route: unhandled stream error");
  } finally {
    clearInterval(keepalive);
  }
});

// ─── GET /conversations/:id/messages/:messageId/trace — retrieval trace (admin) ───
//
// Returns the retrieval trace for a specific assistant message.
// Access is restricted to admin users only.
// Never returns raw source content — identifiers and classification only.

router.get("/conversations/:id/messages/:messageId/trace", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  // Admin-only
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const { getTraceByMessage } = await import("../repositories/retrieval-trace-repository");
    const rawMessageId = req.params["messageId"];
    const messageId = String(Array.isArray(rawMessageId) ? rawMessageId[0] : rawMessageId ?? "");
    const trace = await getTraceByMessage(messageId, actor.orgId);
    if (!trace) {
      res.status(404).json({ error: "Retrieval trace not found" });
      return;
    }
    res.json({ trace });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ─── GET /conversations/:id/traces — all traces for a conversation (admin) ───

router.get("/conversations/:id/traces", async (req: Request, res: Response) => {
  const actor = await resolveActor(req, res);
  if (!actor) return;

  const user = getAuthenticatedUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const { listTracesByConversation } = await import("../repositories/retrieval-trace-repository");
    const traces = await listTracesByConversation(paramId(req), actor.orgId);
    res.json({ traces });
  } catch (err) {
    handleServiceError(res, err);
  }
});

export default router;

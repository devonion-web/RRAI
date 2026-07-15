---
name: RAG Engine v1 — route helpers location
description: No shared helpers.ts in routes/; each route file defines resolveActor, handleServiceError, paramId locally.
---

## Rule

There is **no shared `routes/helpers.ts` module**. Do not import from `"./helpers"` in route files — it will cause a TS compile error.

Each route file (conversations.ts, admin.ts, etc.) defines its own local copies of:
- `resolveActor(req, res)` — resolves userId + orgId from session; returns null + writes 401/403 on failure.
- `handleServiceError(res, err)` — maps Error.status (400/403/404) to response; falls back to 500.
- `paramId(req)` — Express 5 safe string extraction from `req.params["id"]`.

**Why:** These are small enough to inline and keeping them local avoids a shared module that would need to be threaded through the workspace dependency graph.

**How to apply:** When writing a new route file, copy the 3 helpers from conversations.ts. If they grow more complex, consider extracting to a shared lib (not a file in routes/).

## Admin router guard

Admin routes use `/admin{/*splat}` path prefix with `requireAuthenticatedUser` + `requireRole("admin")` middleware applied at the router level:

```typescript
router.use("/admin{/*splat}", requireAuthenticatedUser, requireRole("admin"));
```

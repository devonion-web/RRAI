---
name: AR6 Lens Routing & One-Way Valve
description: How lens routing, partition enforcement, and retrieval provenance work in RRAI; key pitfalls encountered during AR6.
---

## Lens policy location
`artifacts/api-server/src/policies/lens-policy.ts` — canonical source of truth for all four lenses (analyst, intelligence, commercial, delivery), partition permissions, sensitivity ceilings, and one-way valve assertions.

## Routing service
`artifacts/api-server/src/services/lens-routing-service.ts` — pure function, zero I/O. `computeRoutingDecision({ activeLens })` reads the knowledge manifest, applies policy filters, and returns permitted/excluded assets plus policy metadata. Unknown lenses default to analyst.

## Retrieval service
`artifacts/api-server/src/services/context-retrieval-service.ts` — async, hits DB for opportunity. Returns `ContextRetrievalResult` with `permittedBlocks`, `excludedSources`, `usedAssetIds`, `partitionsIncluded`, `usedMemorySources`.

## One-way valve
Analyst lens: `opportunityContextPermitted: false`, `commercialDetailPermitted: false`, `deliveryDetailPermitted: false`. Enforced in both routing (asset filtering) and retrieval (opportunity query skipped + excluded source entry with reason "one-way valve").

## Retrieval provenance
`retrieval_traces` table (lib/db). Schema written to `lib/db/src/schema/retrieval-traces.ts`, exported from `lib/db/src/schema/index.ts`. Repository: `artifacts/api-server/src/repositories/retrieval-trace-repository.ts`.

## Admin trace endpoints
`GET /api/conversations/:id/traces` and `GET /api/conversations/:id/messages/:messageId/trace` — admin only. Admin check: `user.role === "admin"` (not `user.isAdmin` — that field does not exist on the session user type).

## DB push command
Always use `pnpm --filter @workspace/db run push-force` — NOT `pnpm drizzle-kit push` at root (command not found) and NOT `pnpm exec drizzle-kit` from api-server (also fails). drizzle-kit lives only in `lib/db`.

## Test files
- `artifacts/api-server/src/lens-routing.test.ts` — 31 tests, no DB, fast
- `artifacts/api-server/src/context-retrieval.test.ts` — 14 tests, hits real DB, expects WARN log for invalid UUID opportunityIds (non-existent opp IDs like "opp-does-not-exist" will cause a DrizzleQueryError that the service catches gracefully)

## Knowledge manifest
TypeScript runtime registry at `artifacts/api-server/src/lib/knowledge-manifest.ts` (NOT the YAML governance doc). Placeholder assets have `status: "placeholder"` — excluded from all permitted asset lists regardless of partition. Restricted partition assets always excluded.

**Why:** Governance doc (`knowledge/knowledge-manifest.yaml`) is the source of truth for humans; TypeScript file is the authoritative runtime equivalent. They must be kept in sync manually — no YAML parser at runtime.

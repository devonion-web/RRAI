# Current-State Inventory

Status: Evidence-based, Phase 1 output
Date: 10 July 2026

This report distinguishes: **implemented and working**, **implemented but incomplete**, **prototype only**, **referenced in documentation but not implemented**, **not present**. No capability is assumed to exist solely because it appears in a design document.

## Frontend

- **Implemented and working.** React 19 + Vite, pnpm workspace `artifacts/rai`. Module-first shell in `artifacts/rai/src/App.tsx` renders `RaiDashboard` or an active module. Module registry: `artifacts/rai/src/config/modules.js`.

## Backend

- **Implemented and working.** Express 5.2.1, `artifacts/api-server`. Router pattern in `artifacts/api-server/src/routes/index.ts`.

## Database and ORM

- **Implemented but incomplete.** Drizzle ORM + `pg` driver installed (`lib/db/package.json`), but `lib/db/src/schema/index.ts` contains no real tables. The API server uses in-memory `Map` stores instead (`artifacts/api-server/src/lib/bidPackStore.ts`, `artifacts/api-server/src/routes/logicgate.ts`).

## Existing database tables

- **Not present.** No physical tables exist in any database; schema file is empty/boilerplate.

## Pages, routes, capabilities

- **Implemented and working:**
  - LogicGate Specialist module — `artifacts/rai/src/modules/logicgate/LogicGateModule.jsx` (~9,600 lines): deal scoring, pre/post-discovery prep, SoW generation, email drafting.
  - RFP/RFI Workbench — `artifacts/rai/src/modules/rfp/RFPModule.jsx`: document decomposition, section-based drafting with SSE streaming and polling fallback.
  - API routes: `/api/logicgate/*` (`generate-prep`, `post-discovery`, `deal-strategy`, `generate-sow`, etc.) and `/api/rfp/*` (`upload-files`, `detect-sections`, `extract-brief`, `draft`, `assemble`).
- **Referenced in documentation but not implemented:** Proposal Specialist, Marketing Specialist, Delivery Specialist, and Knowledge Specialist modules (referenced in `artifacts/rai/src/App.tsx` and `replit.md`, no corresponding module code exists).

## AI model integrations

- **Implemented and working.** Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`, wrapped in `artifacts/api-server/src/lib/anthropic.ts`. Uses Replit AI Integrations proxy env vars.

## Prompts and system instructions

- **Implemented and working.** Mix of hardcoded prompt/schema constants in route files (e.g. `DASHBOARD_SCHEMA` in `logicgate.ts`) and markdown prompt files in `artifacts/api-server/prompts/` (`decompose.md`, `drafting.md`, `extraction.md`, `respond.md`, `rewrite-block.md`, `validate-decomp.md`, `validate-final.md`, `validate-response.md`).

## File-upload capabilities

- **Implemented and working.** `multer` memory storage; parses `.docx` (mammoth), `.pdf` (pdf-parse), `.xlsx` (xlsx) — `artifacts/api-server/src/routes/rfp.ts`.

## Document storage

- **Implemented, ephemeral only.** In-memory store with a 4-hour TTL for extracted text and parsed spreadsheet rows (`artifacts/api-server/src/lib/docStore.ts`). No persistent object storage (e.g. disk or S3-compatible bucket) is wired up.

## Knowledge retrieval / RAG

- **Implemented but incomplete.** No vector database or semantic search exists. "Retrieval" today is context assembly from uploaded document text plus hardcoded knowledge strings (e.g. `RR_KNOWLEDGE` constant in `rfp.ts`).

## Conversations and message persistence

- **Not present.** No conversation or message persistence layer exists; interactions are request-scoped or held in transient in-memory job/document stores.

## Opportunity or organisation memory

- **Prototype only.** `opportunityStore` and `contactStore` are in-memory `Map` objects in the LogicGate route (`artifacts/api-server/src/routes/logicgate.ts`) that reset on every server restart.

## Authentication

- **Not present.** No auth middleware, session handling, or login flow exists anywhere in the codebase.

## Role and permission controls

- **Not present.** No role or permission model exists; there is no user concept at all.

## Audit logging

- **Implemented and working, narrow scope.** Event-based audit log for RFP bid packs (`artifacts/api-server/src/lib/bidPackStore.ts`). General system logging uses `pino` (`artifacts/api-server/src/lib/logger.ts`). This is operational logging, not a governed compliance audit trail.

## Deployment configuration

- **Implemented.** Workflow-based dev servers per `artifact.toml` files; custom esbuild bundling for the API server (`artifacts/api-server/build.mjs`); documented run commands in `replit.md`.

## Environment variables and secrets

- Referenced in code (`artifacts/api-server/src/lib/anthropic.ts`): `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. `SESSION_SECRET` is provisioned as an environment secret but is **not currently referenced by any application code** (no session middleware exists yet) — flagged as an unused/reserved secret.

## Known incomplete or prototype features

- Database layer (schema exists, unused; all persistence is in-memory).
- Background job store (`artifacts/api-server/src/lib/jobStore.ts`) exists but most AI operations still run in-request, with SSE used for long-running RFP drafting rather than a full job queue.
- Four planned specialist modules (Proposal, Marketing, Delivery, Knowledge) are documentation-only.
- Extensive `architecture/`, `product/`, `capabilities/`, `engines/`, `implementation/` documentation describes a target state (Knowledge/Memory separation, lens routing, learning engine, etc.) that has no corresponding implementation yet — see `reports/architecture-implementation-gap.md`.

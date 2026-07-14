# RRAI: Risk AI

RRAI is a modular AI operating platform for Risk Rising. It provides a dashboard-first experience where users select from specialist modules, each optimised for a specific workflow (currently: LogicGate deal prep/scoring/proposal generation, and an RFP/RFI decomposition and drafting workbench).

## Where it runs

- Development runs entirely inside this Replit workspace via configured workflows (not `pnpm dev` at the root).
- Frontend (`artifacts/rai`): React 19 + Vite, served at `/`.
- API server (`artifacts/api-server`): Express 5, served at `/api`.
- Database: PostgreSQL + Drizzle ORM is installed but the schema is not yet populated; the application currently uses in-memory stores (see `reports/current-state-inventory.md`).

## Technology stack

- pnpm workspaces (monorepo), Node.js 24, TypeScript 5.9
- React 19 + Vite (frontend), Express 5 (API)
- Anthropic Claude via `@anthropic-ai/sdk` for AI generation
- `docx` + `file-saver` for document generation
- Drizzle ORM + PostgreSQL (installed, not yet wired to persistent tables)

## Governing-document hierarchy

1. `architecture/00_RRAI_Master_Context_v2_0.md` — highest authority (Master Context & constitution).
2. `architecture/01_RRAI_Platform_Architecture_v1_0.md` — approved implementation architecture, subordinate to the Master Context.
3. `architecture/` — remaining constitutional architecture documents (numbered 00–17, plus `99 Architecture Index.md`).
4. `product/`, `capabilities/`, `engines/`, `knowledge/`, `prompts/`, `templates/`, `engineering/`, `implementation/` — governed documentation layers beneath the architecture layer.

Where governed documents conflict, the higher-authority document prevails. See `replit.md` for the full governance summary.

## Repository areas

| Path | Purpose |
|---|---|
| `app/` | Reserved target location for the application code migration. Currently empty — code has not been moved here yet. |
| `artifacts/` | Current application code (frontend, API server, mockup sandbox). |
| `architecture/` | Constitutional architecture documents. Do not modify without explicit instruction. |
| `product/` | Executive workflows and product-level experiences. |
| `capabilities/` | Reusable business-level AI capabilities. |
| `engines/` | Lower-level reusable AI services used by capabilities and product workflows. |
| `knowledge/` | Business/domain knowledge. `master-assets/` and `vendor/` are governed source material; `generated/` holds derived artefacts (chunks, embeddings, indexes) and must never become the source of truth. |
| `prompts/` | Prompt definitions. |
| `templates/` | Output templates. |
| `engineering/` | Engineering standards. |
| `implementation/` | Technical implementation specifications. |
| `archive/` | Superseded or retired documents. |
| `reports/` | Evidence-based audits and migration planning reports. |

## Development commands

- `pnpm --filter @workspace/rai run dev` — run the RAI frontend
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

There is no automated test suite configured at this time (see `reports/current-state-inventory.md`).

## Branch and review rules

- No direct AI edits to `main`. Work happens on named branches (e.g. `chore/rrai-repository-foundation`).
- Small, reviewable commits with build/typecheck evidence.
- Architecture, Knowledge, and consequential application changes require human review before merging.
- See `CONTRIBUTING.md` for full contribution rules.

## Current-state limitations

This section describes what exists today, not the target architecture:

- No authentication or role/permission controls are implemented.
- No persistent database tables exist; opportunity, contact, and document data live in in-memory stores and are lost on server restart.
- No vector search or RAG retrieval is implemented; "knowledge" is currently hardcoded strings and uploaded-document text.
- No conversation/message persistence layer exists.
- Proposal, Marketing, Delivery, and Knowledge Specialist modules are referenced in documentation but not implemented.

For the full evidence-based inventory, see `reports/current-state-inventory.md`.

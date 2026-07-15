# RAI: Risk AI

A modular AI operating platform for Risk Rising. RAI provides a dashboard-first experience where users select from specialist modules, each optimised for a specific workflow.

## Run & Operate

- `pnpm --filter @workspace/rai run dev` — run the RAI frontend (port 24148, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview at `/api`)
- `pnpm run typecheck` — full typecheck across all packages (**zero errors required**)
- `pnpm run build` — typecheck + build all packages

## TypeScript Quality Gate

Production code must have **zero TypeScript errors**. "Pre-existing" is not an acceptable exemption.

### Canonical typecheck commands

| Scope | Command |
|---|---|
| Shared libraries only | `pnpm run typecheck:libs` |
| API server only | `pnpm --filter @workspace/api-server run typecheck` |
| Frontend only | `pnpm --filter @workspace/rai run typecheck` |
| Full workspace (required before merging) | `pnpm run typecheck` |

The full command exits non-zero when any production TypeScript error exists. All packages run in parallel; a failure in one does **not** hide failures in another.

### Before typechecking

Always regenerate OpenAPI outputs first so generated clients and Zod schemas are current:

```
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

A clean checkout must be able to regenerate and typecheck successfully with no manual patches.

### Suppression policy

Use `@ts-ignore` or `@ts-expect-error` only when:
- There is a documented upstream typing defect with no safer alternative.
- The suppression is accompanied by an explanatory comment citing the defect.
- The suppressed line is not production logic (e.g. a boundary cast at an I/O seam with unknown type).

`as unknown as T` boundary casts at I/O seams (OIDC claims, database JSON columns) are permitted where the runtime type genuinely cannot be known statically. They must not be used to paper over logic errors.

`as any` is forbidden in production code.

### CI enforcement

`.github/workflows/ci.yml` enforces the full quality gate on every push and pull request:
1. Dependency installation (`pnpm install --frozen-lockfile`)
2. Code generation (`pnpm --filter @workspace/api-spec run codegen`)
3. TypeScript typecheck — **blocks pipeline on failure**
4. Tests
5. Build

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, inline styles (Inter font, navy brand)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used)
- Document generation: `docx` + `file-saver` (LogicGate module)

## Where things live

```
artifacts/rai/src/
  App.tsx                           RAI shell — module state management + back-bar
  index.css                         CSS variables (RAI navy theme)
  config/modules.js                 Module registry — add new modules here
  components/RaiDashboard.jsx       Home screen with module cards
  modules/
    logicgate/
      LogicGateModule.jsx           Full LogicGate assistant (ported from original App.jsx)
      api.js                        API client — fetch calls to /api/* endpoints
      assets/rr-logo.png            Logo placeholder (replace with real asset)
```

## Architecture decisions

- **Module-first shell**: `App.tsx` renders either `RaiDashboard` or the active module. Adding a new module = one entry in `config/modules.js` + one new component.
- **LogicGate module is self-contained**: All 8,696 lines of the original `App.jsx` live in `LogicGateModule.jsx` with zero logic changes. Only the export was renamed.
- **API client in module directory**: `modules/logicgate/api.js` contains all fetch calls. Endpoint paths follow the pattern `/api/<resource>`.
- **Inline styles throughout**: Both the RAI shell and LogicGate module use inline JS style objects (no Tailwind classes in module code). Keeps module code portable and avoids CSS variable dependency.
- **allowJs + checkJs:false**: TypeScript config allows importing the plain-JS LogicGate module without type errors.

## Product

RAI is a multi-module AI operating platform. Currently ships Module 1 (LogicGate Specialist) which provides pre/post-discovery deal prep, scoring, proposal generation, SoW creation and email drafting for LogicGate sales opportunities. Four further modules are planned: Proposal, Marketing, Delivery, and Knowledge Specialists.

## User preferences

_Populate as you build._

## Gotchas

- **LogicGate module needs a real backend**: `modules/logicgate/api.js` calls `/api/generate-prep`, `/api/post-discovery`, etc. These routes must be implemented in `artifacts/api-server/src/routes/` and require an `ANTHROPIC_API_KEY` environment variable.
- **rr-logo.png placeholder**: Replace `artifacts/rai/src/modules/logicgate/assets/rr-logo.png` with the real Risk Rising logo PNG.
- **Do not run `pnpm dev` at the workspace root** — always use `--filter`.
- **LogicGate module size**: The file is ~8,700 lines. Babel deoptimises styling (just a warning, not an error).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Governance (RRAI repository foundation)

- RRAI is one platform with multiple lenses.
- `architecture/00_RRAI_Master_Context_v2_0.md` is the highest-authority document. `architecture/01_RRAI_Platform_Architecture_v1_0.md` is the approved implementation architecture immediately beneath it. The three product-governing documents (`product/00_RRAI_Product_Philosophy.md`, `product/01_RRAI_Product_Principles.md`, `product/02_RRAI_Executive_Workbench.md`) sit beneath those two. Where governed documents conflict, the higher-authority document prevails. The root `RRAI Constitution.md` is a redirect only — it is not the authority.
- Do not redesign architecture while implementing a lower-level task. Inspect the governing files and current implementation before changing established behaviour.
- Master Knowledge Assets (`knowledge/master-assets/`) are governed source material. Generated chunks, summaries, embeddings and indexes (`knowledge/generated/`) are derived artefacts and never become the source of truth.
- Runtime Memory (conversations, opportunity/session state) is separate from governed Knowledge.
- Commercial and delivery information must not be exposed to Analyst-lens reasoning.
- Every agent or reasoning run operates inside one active lens.
- Do not automatically alter approved Knowledge. Learning may propose Knowledge changes but cannot approve or apply them.
- Human approval is required before: external publication, customer commitments, pricing or terms, legal or regulatory assertions, Knowledge changes, sending communications, opportunity/project status changes, and external-system actions.
- Never expose API keys, database credentials or secrets in code, commits, logs or documentation.
- Use UK English in governed documentation (`architecture/`, `product/`, `capabilities/`, `engines/`, `knowledge/`, `prompts/`, `templates/`, `engineering/`, `implementation/`).
- Prefer small, reviewable changes on branches; do not commit generated runtime data, uploaded customer documents, database contents or secrets to Git.
- See `reports/current-state-inventory.md`, `reports/repository-migration-plan.md`, `reports/architecture-implementation-gap.md`, and `reports/github-readiness-checklist.md` for the current evidence-based state of the migration.

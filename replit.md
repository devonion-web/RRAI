# RAI: Risk AI

A modular AI operating platform for Risk Rising. RAI provides a dashboard-first experience where users select from specialist modules, each optimised for a specific workflow.

## Run & Operate

- `pnpm --filter @workspace/rai run dev` — run the RAI frontend (port 24148, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

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

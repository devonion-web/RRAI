# Repository Migration Plan

Status: Proposal only — no moves performed in this phase.
Date: 10 July 2026

This report lists proposed target locations for existing files/directories. No files have been moved. All moves are deferred to a future, explicitly-scoped phase.

| Current path | Purpose | Proposed target | Action | Reason | Dependency | Risk | Proposed phase |
|---|---|---|---|---|---|---|---|
| `artifacts/rai/` | Frontend application | `app/frontend/` (or remain in `artifacts/rai/`) | Leave unchanged for now | Replit workflow/artifact wiring depends on current path; moving requires updating `artifact.toml` and workflow config | Replit artifact routing, workflow definitions | High — moving breaks the live preview/build pipeline if not done carefully | Future dedicated "code migration" phase |
| `artifacts/api-server/` | Backend API | `app/api/` (or remain in `artifacts/api-server/`) | Leave unchanged for now | Same as above | Replit artifact routing, workflow definitions | High | Future dedicated "code migration" phase |
| `artifacts/mockup-sandbox/` | Canvas/design preview tooling | Remain in `artifacts/mockup-sandbox/` | Leave unchanged | Internal tooling, not part of governed product surface | Canvas skill | Low | Not planned |
| `lib/db/` | Drizzle schema + DB client | Remain in `lib/db/` | Leave unchanged | Workspace-lib convention; schema population is a separate task from repository structure | `pnpm-workspace.yaml` references | Low | Schema population is a future phase, not a move |
| `architecture/*.md` | Constitutional architecture | Remain in `architecture/` | Keep as-is | Already in the target governed layer | None | None | N/A |
| `product/*.md`, `capabilities/*.md`, `engines/*.md`, `knowledge/*.md`, `prompts/*.md`, `templates/*.md`, `engineering/*.md`, `implementation/*.md` | Governed documentation | Remain in current folders | Keep as-is | Already in target governed layers | None | None | N/A |
| `RRAI Constitution.md` (root) | Redirect only — substantive content superseded | Remain at root as redirect | No move required | Redirects to `architecture/00_RRAI_Master_Context_v2_0.md`. Original v1.0 content archived at `archive/RRAI Constitution v1.0.md`. | None | None | Resolved — July 2026 |
| `replit.md` | Operating instructions for Replit Agent | Remain at root | Keep as-is | Required at root for Replit Agent context loading | None | None | N/A |
| `.agents/memory/` | Persistent agent memory | Remain as-is | Keep as-is | Internal tooling, not governed documentation | None | None | N/A |
| `attached_assets/` | User-uploaded task instruction files | Consider archiving processed instruction files | Move processed files to `archive/instructions/` | Keeps root clutter-free once instructions are actioned | None | Low | Housekeeping, any time |

## Notes

- No existing file was found to be misplaced relative to the layer definitions established in prior tidy-up passes (see `reports/current-state-inventory.md` for corroborating evidence).
- The governing-document authority question is resolved (July 2026): `architecture/00_RRAI_Master_Context_v2_0.md` is the highest authority; `architecture/01_RRAI_Platform_Architecture_v1_0.md` is the approved implementation architecture immediately beneath it; the root `RRAI Constitution.md` is a redirect only; the original constitution v1.0 is archived at `archive/RRAI Constitution v1.0.md`.
- Application code migration into `app/` is intentionally deferred — it is a higher-risk change requiring workflow/artifact reconfiguration and is out of scope for this repository-foundation phase.

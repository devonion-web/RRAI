# Build Status
## 08_Build_Status.md
Generated: 2026-07-15 13:37:27 UTC

---

## Summary

| Check | Status |
|---|---|
| TypeScript (all packages) | ✅ Zero errors |
| api-server production build | ✅ Pass (17.1MB bundle via esbuild) |
| rai frontend build | ✅ Pass (requires PORT env — workflow-provided) |
| CI pipeline | ✅ Present (`.github/workflows/ci.yml`) |
| Branch | `feature/development-orchestrator-foundation` |
| Commit | `b747652` — Improve search relevance and recall by optimizing full-text search |

---

## TypeScript Configuration

| Package | Mode | Notes |
|---|---|---|
| `lib/db` | composite + emit | tsc --build; declarations emitted |
| `artifacts/api-server` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |
| `artifacts/rai` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |
| `scripts` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |

**TypeScript version:** 5.9 (workspace root devDependency)

---

## Build Tools

- **api-server:** esbuild via `artifacts/api-server/build.mjs` — bundles to `dist/index.mjs`
- **rai frontend:** Vite 7 — bundles to `artifacts/rai/dist/`
- **lib/db:** tsc --build (composite, emits declarations)

---

## Known Build Warnings

1. **api-server bundle size:** 17.1MB (source map 26.2MB) — due to LogicGate module size (~9,600 LOC). Not an error.
2. **Babel deoptimisation:** Vite/Babel warns about large LogicGate module file — not an error.
3. **CI codegen step:** CI runs `pnpm --filter @workspace/api-spec run codegen` but no `api-spec` package exists — this step will fail if api-spec is absent.

---

## CI Pipeline

- **Trigger:** Push or PR to any branch
- **Steps:** install → codegen → typecheck → tests → build
- **Blocking:** TypeScript typecheck blocks pipeline on failure
- **Node.js:** v24
- **Package manager:** pnpm (frozen lockfile install)

---

## Production Readiness

| Area | Status |
|---|---|
| TypeScript | ✅ Zero errors |
| Build | ✅ Passes |
| Auth | ✅ OIDC + sessions |
| Knowledge retrieval | ✅ Evaluated (all gates pass) |
| Database | ✅ Migrations applied |
| Secrets | ✅ Via Replit env |
| API | ✅ Routes active |
| Logging | ✅ pino structured logging |
| Error handling | ✅ Express error middleware |

---

_typecheck: `pnpm run typecheck`_
_build api-server: `pnpm --filter @workspace/api-server run build`_
_build frontend: requires PORT env (workflow-provided; fails from bare shell)_

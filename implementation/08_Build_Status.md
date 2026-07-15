<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit c23c100 (branch: feature/development-orchestrator-foundation)
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
# Build Status
## 08_Build_Status.md

---

## Summary

| Check | Status |
| --- | --- |
| TypeScript (all packages) | ✅ Zero errors |
| api-server production build | ✅ Pass (17.1MB bundle via esbuild) |
| rai frontend build | ✅ Pass (requires PORT env — workflow-provided) |
| CI pipeline | ✅ Present (`.github/workflows/ci.yml`) |
| Branch | `feature/development-orchestrator-foundation` |
| Commit | `c23c100` — Add query client provider to enable data fetching |

---

## TypeScript Configuration

| Package | Mode | Notes |
| --- | --- | --- |
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

1. **api-server bundle size:** 17.1MB — due to LogicGate module size. Not an error.
2. **Babel deoptimisation:** Vite/Babel warns about large LogicGate module file. Not an error.
3. **CI codegen step:** CI runs `pnpm --filter @workspace/api-spec run codegen` but `api-spec` package is absent — this step fails gracefully in CI.

---

## CI Pipeline Steps

- Checkout
- Setup Node.js
- Setup pnpm
- Get pnpm store directory
- Cache pnpm store
- Install dependencies
- Code generation (OpenAPI → client + Zod schemas)
- TypeScript typecheck (zero errors required)
- Platform status check (documents must be current)
- Run tests
- Production build

---

## Production Readiness

| Area | Status |
| --- | --- |
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

_Typecheck: `pnpm run typecheck`_
_Build api-server: `pnpm --filter @workspace/api-server run build`_
_Frontend build requires PORT env (workflow-provided; fails from bare shell by design)._

---
name: TypeScript quality gate
description: Zero-error TS policy, suppression rules, CI config, and codegen-first workflow.
---

## Rule
Production code must have zero TypeScript errors. "Pre-existing" is not an acceptable exemption category.

**Why:** Silent type errors mask contract mismatches that become runtime bugs. Two historical errors (anthropic.ts:124, rfp.ts:722) were accepted as pre-existing and had drifted for several sessions before being fixed in Architecture Remediation #4.

## Root causes of the fixed errors

| File | Error | Root cause | Fix |
|---|---|---|---|
| `src/lib/anthropic.ts` | TS2749 — `Anthropic.APIError` used as a type in `as` cast | Class name used as type in assertion after being stored in a variable (breaks TS narrowing) | Replaced `const isApiErr = …; if (isApiErr && (err as Anthropic.APIError).status)` with `if (err instanceof Anthropic.APIError && err.status === 400)` — single inline instanceof gives proper narrowing |
| `src/routes/rfp.ts` | TS2322 — `Promise<unknown>` not assignable to typed return | `callClaudeJSON` called without its generic type parameter; `.catch` return type did not widen correctly from `unknown` | Added `callClaudeJSON<ConstraintsResult>(…)` explicit type parameter, matching the pattern already used for `sectionTasks` |

## Suppression policy
- `@ts-ignore` / `@ts-expect-error`: only with an explanatory comment citing a documented upstream defect; forbidden in production logic.
- `as any`: forbidden in production code.
- `as unknown as T` boundary casts: permitted at genuine I/O seams (OIDC claims, DB JSON columns) where the runtime type cannot be known statically. Must not paper over logic errors.

**How to apply:** Before adding any suppression, ask "can I fix the underlying contract instead?" If not, document why.

## Canonical commands

```
# Always regenerate before typechecking
pnpm --filter @workspace/api-spec run codegen

# Full workspace (required before merging; exits non-zero on any error)
pnpm run typecheck

# Per-package
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/rai run typecheck
```

## CI
`.github/workflows/ci.yml` — runs on every push/PR:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @workspace/api-spec run codegen`
3. `pnpm run typecheck` — blocks pipeline on failure
4. Tests
5. Build

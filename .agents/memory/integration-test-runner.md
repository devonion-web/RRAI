---
name: Integration test runner
description: How to run TypeScript integration tests against the live dev database.
---

The api-server integration tests live in `artifacts/api-server/src/routes/logicgate.test.ts` and use `node:test` + `node:assert`.

**Run command:**
```
pnpm --filter @workspace/api-server run test:integration
```

Which executes:
```
node --test --import tsx/esm src/routes/logicgate.test.ts
```

**Why tsx/esm?** Plain `node --test` and `node --experimental-strip-types` both fail on `lib/db/src/index.ts` because it uses `export * from "./schema"` (a directory import). Node.js ESM requires explicit file extensions (`./schema/index.js`), but TypeScript allows the bare form. tsx resolves this by handling TypeScript module resolution before Node.js sees the import.

**Why NOT vitest?** Blocked by firewall in this environment.

**Database:** Tests use `DATABASE_URL` from the environment (the dev Postgres instance). Each test suite creates and cleans up its own org/user rows. Tests are safe to re-run without resetting the database.

**Pattern:**
- `before()` — create test user + org + membership
- `after()` — delete rows in FK dependency order
- Test IDs are timestamped to avoid collisions between parallel runs

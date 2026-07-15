---
name: DB schema lib rebuild
description: After adding tables to lib/db, typecheck:libs must be run before leaf packages see the new exports.
---

After editing `lib/db/src/schema/*.ts` (adding new tables or types), run:

```
pnpm run typecheck:libs
```

This executes `tsc --build` on the composite lib, which regenerates `lib/db/dist/schema/*.d.ts`. Without this step, any artifact (api-server, rai) importing from `@workspace/db/schema` will see TS2305 "has no exported member" errors for every new symbol.

**Why:** `@workspace/db` is a composite TypeScript project that emits declaration files only. Leaf artifacts import from the compiled declarations, not the source. The root `typecheck:libs` command is what drives the build; leaf `typecheck` commands do not.

**How to apply:** Any time a schema file changes, run `typecheck:libs` first, then run the leaf package typecheck.

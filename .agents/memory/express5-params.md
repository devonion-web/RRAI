---
name: Express 5 params typing
description: req.params["id"] is typed as string | string[] in Express 5 — use the normalisation helper pattern in all routes.
---

## Rule
Never pass `req.params.id` or `req.params["id"]` directly to a function expecting `string`. In Express 5, the declared type is `string | string[]`.

**Why:** Express 5 tightened the typing of `ParamsDictionary` to reflect that query params can technically be repeated. Even though route params like `:id` are always strings at runtime, the TypeScript type is `string | string[]`. All existing routes use the normalise-first pattern.

## How to apply
Define a local helper in every route file that uses params:

```typescript
function paramId(req: Request): string {
  const raw = req.params["id"];
  return String(Array.isArray(raw) ? raw[0] : raw ?? "");
}
```

Then call `paramId(req)` instead of `req.params["id"]` anywhere you need a `string`.

For named params other than `id`, apply the same pattern with the relevant key.

See also: `logicgate.ts` uses `String(Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"])` inline at each call site; the helper approach is preferred for readability.

---
name: OpenAPI YAML structure
description: Duplicate top-level keys under components cause orval to fail silently.
---

In `lib/api-spec/openapi.yaml`, the `components:` block must have exactly one of each:
- `parameters:`
- `schemas:`
- `responses:`

If a second `parameters:` block is added (e.g. when appending new content to the file), YAML processes it as a duplicate key and either silently drops one or causes a parse error. Orval then fails with:

```
Failed to resolve input: Please provide a valid string value or pass a loader to process the input
```

**Why:** YAML spec disallows duplicate mapping keys. Most parsers drop the first occurrence when they encounter a duplicate, so any parameters defined in the first block would be silently lost.

**How to apply:** When adding new parameters or responses, always merge them into the _existing_ block rather than appending a new top-level key. Use grep to check for duplicate keys before committing OpenAPI changes:
```
grep -n "^  parameters:\|^  schemas:\|^  responses:" lib/api-spec/openapi.yaml
```

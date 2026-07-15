---
name: Pre-existing TS errors to preserve
description: Two TypeScript errors in api-server that exist before auth remediation and must not be "fixed" without explicit instruction.
---

## Rule
Do not attempt to fix these two errors. They are pre-existing and are scoped to unrelated code paths. Fixing them risks introducing side-effects in large, complex routes.

## Errors

1. `src/lib/anthropic.ts(124,29)` — `'Anthropic.APIError' refers to a value, but is being used as a type here. Did you mean 'typeof Anthropic.APIError'?` — Anthropic SDK type usage quirk.

2. `src/routes/rfp.ts(722,7)` — `Type 'Promise<unknown>' is not assignable to type 'Promise<{ crossCuttingConstraints: ... }>'.` — Untyped return in a large RFP route.

**Why:** These were present before auth remediation work began. Addressing them is a separate task that requires careful review of the Anthropic SDK usage and the RFP route logic.

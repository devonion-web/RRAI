# Contributing to RRAI

## Branching

- All changes are made on a named branch, never committed directly to `main`.
- Branch names should describe the change scope, e.g. `chore/rrai-repository-foundation`, `feat/rfp-drafting`, `fix/anchor-resolver`.
- AI agents (Replit Agent, Claude Code) must not push directly to `main`. Changes land on a branch and are merged after human review.

## Commit discipline

- Keep commits small and scoped to a single logical change.
- Do not bundle unrelated fixes into a task branch — flag them separately instead.
- Each commit or pull request that touches application code should include evidence that `pnpm run typecheck`, `pnpm run build`, and any existing tests were run, along with their results (including pre-existing failures, recorded separately from new ones).

## Governing-document conformance

- Check `architecture/`, `product/`, `capabilities/`, `engines/`, `knowledge/`, `prompts/`, `templates/`, `engineering/`, and `implementation/` before changing established behaviour — do not redesign architecture while implementing a lower-level task.
- `RRAI Constitution.md` (v1.0, root) is the highest-authority document and takes precedence over all lower-level documents.
- Use UK English in all governed documentation.

## Data and secrets

- Never commit `.env` files, API keys, database credentials, or other secrets.
- Never commit runtime data: conversation logs, uploaded customer/opportunity documents, database exports, generated embeddings, or vector indexes.
- `knowledge/generated/` is derived and must never be treated as, or promoted to, source of truth.

## Human review gates

Human approval is required before:

- External publication or customer communications
- Pricing, commercial terms, or legal/regulatory assertions
- Knowledge changes (proposed by Learning but not self-applied)
- Opportunity/project status changes
- Any external-system action
- Merging changes to architecture, Knowledge, or consequential application behaviour

## Pull requests

- Describe what changed and why, referencing the relevant governed document(s) where applicable.
- List build/typecheck/test evidence.
- Call out any known pre-existing failures that were not introduced by the change.

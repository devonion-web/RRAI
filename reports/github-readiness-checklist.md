# GitHub Readiness Checklist

Status: Phase 2/7 output
Date: 10 July 2026

| Item | Status | Notes |
|---|---|---|
| Git repository initialised | ✅ Yes | Repository already existed prior to this task (`main` branch, commit history present). |
| Branch created for this work | ❌ Not created | Attempting `git checkout -b chore/rrai-repository-foundation` was blocked: branch creation is a destructive/mutating git operation in this environment and can only be run through a background Project Task, not directly by the main agent. **Manual action required — see below.** |
| Current state checkpointed | ✅ Yes | Replit's automatic checkpoint system created a checkpoint at the end of this task loop (visible in the Checkpoints panel), capturing the working tree before/after this change. |
| `.gitignore` safe | ✅ Yes | Reviewed and extended: excludes `.env`/secrets, `node_modules`, build output, uploads, exports, database dumps, embeddings, and vector indexes. Governed Markdown and source code are not ignored. |
| Secrets excluded | ✅ Yes | No secrets are hardcoded in the repository; `SESSION_SECRET` and Anthropic proxy credentials are managed via Replit environment secrets, not committed files. |
| Current build status | ⚠️ Pre-existing failures | `pnpm run typecheck` fails with 2 pre-existing TypeScript errors in `artifacts/api-server` (`src/lib/anthropic.ts:124`, `src/routes/rfp.ts:742`) — unrelated to this task, not fixed per instruction to avoid unrelated changes. Frontend workflows (`rai`, `mockup-sandbox`, `api-server`) are running per the system status. |
| Repository ready or not ready to connect | ⚠️ Not fully ready | Ready in terms of `.gitignore` hygiene and documentation structure. Not ready in terms of: (a) no dedicated branch exists yet for this change, and (b) no GitHub remote is configured — only a `gitsafe-backup` remote (Replit's internal backup) is present. |
| Manual GitHub/Replit steps required | See below | |

## Manual actions required from you

1. **Branch creation**: I could not create `chore/rrai-repository-foundation` directly (blocked as a destructive git operation for the main agent). To create it, either:
   - Ask me to raise this as a background Project Task, which has permission to run the branch creation, or
   - Create it yourself from the Replit Git pane / shell: `git checkout -b chore/rrai-repository-foundation`, then commit the changes from this task onto that branch.
2. **Connect GitHub**: No GitHub remote is currently configured (only Replit's internal `gitsafe-backup` remote exists). To connect GitHub:
   - Open the **Git** pane in the Replit sidebar.
   - Choose **Connect to GitHub** (or **Create a Repo on GitHub** if one doesn't exist yet).
   - Authorize Replit's GitHub integration if prompted.
   - Once connected, verify the remote with `git remote -v` — it should show a `github.com` URL, not just `gitsafe-backup`.
   - I have not claimed GitHub is connected anywhere in this task, since the remote has not been verified.

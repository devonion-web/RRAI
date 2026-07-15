# Development Workspace Integration Specification
## Platform Status Display

**Status:** Implementation specification only — no UI code is created here.

---

## Purpose

The Development Workspace module may display a read-only view of the generated
platform status evidence. This document specifies how that display must consume
the evidence files without treating them as architecture authority.

---

## Evidence Sources

The Development Workspace reads the following generated documents from the
`implementation/` directory:

| Document | Display as | Section |
| --- | --- | --- |
| `00_Platform_Status.md` | Platform Status summary | Overview panel |
| `01_Architecture_Progress.md` | Architecture progress table | Progress panel |
| `02_Engine_Status.md` | Engine readiness summary | Engine panel |
| `07_Test_Status.md` | Test pass rates and coverage gaps | Quality panel |
| `08_Build_Status.md` | Build and CI status | Build panel |

Documents `03–06` (API, Database, UI, Knowledge) may optionally be surfaced
in a Detail view but are not required for the initial integration.

---

## Data Contract

The Development Workspace **must not** parse Markdown for structured data.
Instead, the platform status generator should export a machine-readable
companion file alongside the Markdown documents.

### Proposed: `implementation/platform-status.json`

The generator should produce (in addition to the Markdown documents) a JSON
summary with the following structure:

```jsonc
{
  "generatedAt": null,           // always null; never a timestamp
  "commit": "abc1234",           // git commit short SHA
  "branch": "main",              // git branch
  "commitDate": "2026-07-15 ...",
  "engines": [
    {
      "name": "Authentication Engine",
      "status": "Implemented",   // Implemented | Partial | Schema-only | Planned
      "notes": "OIDC + PKCE + PostgreSQL sessions"
    }
    // ...
  ],
  "modules": [
    { "id": "rfp", "title": "RFP Response Drafter", "status": "active" },
    { "id": "proposal", "title": "Proposal Specialist", "status": "coming_soon" }
  ],
  "counts": {
    "tables": 22,
    "routes": 45,
    "knowledgeAssets": 10,
    "testFiles": 4,
    "evalCases": 22
  },
  "quality": {
    "typescriptErrors": 0,
    "lastTestPass": "19/19",
    "recall5": "100.0%",
    "top1": "77.4%"
  }
}
```

This JSON file is produced by the same `generate:platform-status` command,
is gitignored like other generated artefacts, and is consumed by the
Development Workspace API endpoint.

### API Endpoint

The Development Workspace module reads status via an API endpoint rather
than direct filesystem access:

```
GET /api/development/platform-status
```

The response is the `platform-status.json` content, served by the existing
`development.ts` route file. The endpoint reads the JSON file from the
filesystem at runtime.

Authentication: `requireRole("admin")` — this is internal tooling.

---

## Display Rules

1. **Evidence classification notice must be visible.** Every panel that
   displays generated evidence must include a visible label:

   > _Platform evidence — derived from repository state at commit `abc1234`.
   > Not an architecture document. [Regenerate](#)_

2. **No editing from the UI.** The display is strictly read-only. The
   workspace must not expose controls to modify the evidence files.

3. **Stale-state indicator.** If the stored `platform-status.json` is missing
   or older than the current commit (comparison via commit SHA), the UI must
   display a stale-data warning rather than showing outdated data.

4. **Architecture documents take precedence.** The display must include a
   persistent note linking to the governing architecture documents. If the UI
   shows completion status, it must label it "derived evidence, not
   architecture authority" and link to:
   - `architecture/00_RRAI_Master_Context_v2_0.md`
   - `architecture/01_RRAI_Platform_Architecture_v1_0.md`

5. **No capability inference.** The UI must not derive conclusions from the
   evidence that the architecture documents have not sanctioned. For example,
   showing "80% complete" when the evidence only supports a categorical
   status (Implemented / Partial / Planned) is not permitted.

---

## What NOT to Build

- **No live re-generation from the UI.** Triggering `generate:platform-status`
  from the browser is not in scope. The command is a developer operation.
- **No direct GitHub or git access from the browser.**
- **No editing of knowledge or architecture documents from this view.**
- **No LLM reasoning over the evidence files.** The evidence is for human
  review; it must not be fed to an LLM as if it were an authoritative knowledge
  source.

---

## Implementation Sequence

1. Add `platform-status.json` output to the generator (`generate:platform-status`).
2. Add `GET /api/development/platform-status` route (reads JSON file).
3. Add a Platform Status panel to the Development Workspace module.
4. Display: commit SHA, engine status table, module status, quality gate summary.
5. Add stale-state check and evidence classification notice.

---

_This specification does not constitute an approved architecture change.
It must be reviewed against architecture/00_RRAI_Master_Context_v2_0.md before implementation begins._

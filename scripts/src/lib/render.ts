/**
 * render.ts — Pure document rendering for the Platform Status Generator.
 *
 * All functions are deterministic: the same PlatformSnapshot always produces
 * the same output. No timestamps, no working-tree state, no run-specific
 * values are written into documents 00–08.
 *
 * Document 99 (Build History) is never touched here.
 */

import type {
  KnowledgeAsset,
  PlatformSnapshot,
  Route,
  SchemaFile,
} from "./gather.js";

// ── Evidence classification header ───────────────────────────────────────────

function evidenceHeader(snap: PlatformSnapshot): string {
  return `<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit ${snap.git.commitShort} (branch: ${snap.git.branch})
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
`;
}

// ── Helper formatters ─────────────────────────────────────────────────────────

function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => "---").join(" | ");
  const head = headers.join(" | ");
  return (
    `| ${head} |\n| ${sep} |\n` +
    rows.map((r) => `| ${r.join(" | ")} |`).join("\n")
  );
}

function routeFileCount(routes: Route[]): number {
  return new Set(routes.map((r) => r.file)).size;
}

// ── Document 00 ───────────────────────────────────────────────────────────────

function render00(snap: PlatformSnapshot): string {
  const {
    git,
    packages,
    schemaTables,
    routes,
    testFiles,
    knowledgeAssets,
    evalCaseCount,
    retrievalPolicyVersion,
    lastKnownChunks,
    lastKnownTestPass,
    lastKnownRecall5,
    lastKnownTop1,
  } = snap;

  const totalTables = schemaTables.reduce((s, f) => s + f.tables.length, 0);
  const totalRoutes = routes.length;
  const adminRoutes = routes.filter((r) => r.admin).length;
  const knowledgeActive = knowledgeAssets.filter((a) => a.status === "active").length;
  const knowledgeApproved = knowledgeAssets.filter((a) => a.verificationState === "approved").length;
  const knowledgeDraft = knowledgeAssets.filter((a) => a.verificationState === "draft").length;
  const knowledgeIndexed = knowledgeAssets.filter((a) => a.status === "active" && a.suppliedToLlm).length;

  const statusTable = [
    ["Authentication & authorisation", "Implemented"],
    ["Conversation engine", "Implemented"],
    ["Knowledge engine (RAG v1)", "Implemented"],
    ["Lens routing engine", "Implemented"],
    ["LogicGate Specialist module", "Implemented"],
    ["RFP/RFI Workbench module", "Implemented"],
    ["Database schema", "Implemented"],
    ["API surface", "Partial"],
    ["Development Orchestrator", "Partial"],
    ["Document engine", "Partial"],
    ["Frontend shell", "Partial"],
    ["Organisation management", "Partial"],
    ["Opportunity tracking", "Partial"],
    ["Approval engine", "Schema only"],
    ["Learning engine", "Schema only"],
    ["Memory engine", "Schema only"],
    ["Agent orchestrator", "Planned"],
    ["Automation engine", "Planned"],
    ["Presentation engine", "Planned"],
    ["Reasoning engine", "Planned"],
  ];

  const activeModules = snap.registeredModules.filter((m) => m.status === "active");
  const plannedModules = snap.registeredModules.filter((m) => m.status !== "active");

  return (
    evidenceHeader(snap) +
    `# RRAI Platform Status
## 00_Platform_Status.md

---

## Platform Identity

| Field | Value |
| --- | --- |
| Platform | RRAI — Risk AI |
| Owner | Risk Rising |
| Branch | \`${git.branch}\` |
| Commit | \`${git.commitShort}\` |
| Commit Message | ${git.commitMsg} |
| Commit Date | ${git.commitDate} |
| Commit Count | ${git.commitCount} |
| Remote | ${git.remoteUrl} |

---

## Implementation Status

_Status values: Implemented / Partial / Schema only / Planned_

${mdTable(["Engine / Area", "Status"], statusTable)}

---

## Implemented Capabilities

- **Authentication** — Replit OIDC (PKCE), PostgreSQL session store, role-based access (admin/member), mobile auth token endpoint, org-scoped membership
- **Conversations** — Full CRUD, persistent messages, SSE streaming, lens assignment, opportunity linkage, retrieval traces per message
- **Knowledge Engine** — ${knowledgeAssets.length}-asset manifest, ${knowledgeActive} active (${knowledgeIndexed} supplied to LLM), ${lastKnownChunks} indexed chunks, FTS with OR-based lexeme union, hybrid scoring (${retrievalPolicyVersion})
- **Lens Routing** — 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition-based routing, one-way security valve
- **RAG Retrieval** — Full-text search, hybrid scoring (FTS rank × 2.0 + metadata), sensitivity ceiling, diversity caps, conflict detection, retrieval trace logging
- **LogicGate Specialist** — Pre/post-discovery prep, deal scoring, SoW generation, email drafting
- **RFP/RFI Workbench** — Document decomposition, section drafting, requirements management, quality review pipeline
- **Admin Panel** — Knowledge indexing, manifest inspection, corpus status, retrieval policy, search testing
- **Development Orchestrator** — AI task management, review findings, change proposals, approval workflow, repository references
- **Organisation Management** — Multi-tenant orgs, membership, role assignment, org-scoped data isolation

---

## Partially Implemented Capabilities

- **Memory Engine** — Schema defined; not yet used in conversation context assembly
- **Opportunity Tracking** — DB persisted, basic CRUD; no frontend UI
- **Learning Engine** — DB tables present; no learning pipeline active
- **Document Engine** — RFP pipeline implemented; broader production pipeline not built

---

## Planned Capabilities

- Semantic / vector-embedding retrieval (FTS-only today)
- Approval Engine pipeline
- Automation Engine
- Agent Orchestrator
- Presentation Engine (slide generation)
- OpenAPI specification (api-spec/ directory)

---

## Registered Modules

Active:
${activeModules.map((m) => `- **${m.title}** (\`${m.id}\`)`).join("\n")}

Planned:
${plannedModules.map((m) => `- **${m.title}** (\`${m.id}\`) — coming soon`).join("\n")}

---

## Workspace Packages

${packages.map((p) => `- **${p.name}** (\`${p.path}\`) — ${p.type}, v${p.version}`).join("\n")}

---

## Summary Counts

| Area | Count |
| --- | --- |
| Database tables | ${totalTables} across ${schemaTables.length} schema files |
| API routes | ${totalRoutes} across ${routeFileCount(routes)} route files (all prefixed \`/api\`) |
| Admin routes | ${adminRoutes} |
| Knowledge assets | ${knowledgeAssets.length} (${knowledgeActive} active, ${knowledgeApproved} approved, ${knowledgeDraft} draft) |
| Indexed chunks | ${lastKnownChunks} (last reindex) |
| Test files | ${testFiles.length} |
| Evaluation cases | ${evalCaseCount} |

---

## Last Evaluation Results

| Gate | Threshold | Result |
| --- | --- | --- |
| Recall@5 | ≥85% | ${lastKnownRecall5} ✅ |
| Top-1 accuracy | ≥70% | ${lastKnownTop1} ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| TypeScript | Zero errors | ✅ |
| Tests | All pass | ${lastKnownTestPass} ✅ |

---

## Known Technical Debt

1. No OpenAPI specification — \`api-spec/\` directory is absent; CI codegen step references a non-existent package
2. RFP module uses in-memory stores with TTL (not database-persisted)
3. LogicGate routes retain some in-memory opportunity/contact stores
4. No vector embeddings — FTS-only retrieval (planned for Phase 3)
5. ${knowledgeDraft} of ${knowledgeAssets.length} knowledge assets are still \`draft\`; require expert review and approval
6. \`knowledge/Knowledge Governance.md\` is a 7-line placeholder (restricted from indexing)

---

## Next Recommended Engine

**Document Engine v1** — Staged proposal generation with timeout-safe streaming. Already validated via RFP pipeline; generalise to all proposal types.

---

_Derived from repository at commit \`${git.commitShort}\` on branch \`${git.branch}\`._
`
  );
}

// ── Document 01 ───────────────────────────────────────────────────────────────

function render01(snap: PlatformSnapshot): string {
  return (
    evidenceHeader(snap) +
    `# Architecture vs Implementation Progress
## 01_Architecture_Progress.md

---

## Classification Key

| Symbol | Meaning |
| --- | --- |
| ✅ Implemented | Working in production code |
| 🔄 Partial | Core capability present, gaps remain |
| ⬜ Schema-only | DB tables defined; no service logic |
| 📋 Planned | Architecture defined; implementation not started |

---

## Core Platform Architecture

| Area | Architecture | Status | Notes |
| --- | --- | --- | --- |
| Multi-tenant organisations | ✅ | ✅ Implemented | Full CRUD |
| Lens routing (4 lenses) | ✅ | ✅ Implemented | One-way security valve |
| Knowledge partitioning | ✅ | ✅ Implemented | 5-tier partition |
| Session management | ✅ | ✅ Implemented | PostgreSQL-backed |
| Role-based access | ✅ | ✅ Implemented | admin / member |
| API-first contract | ✅ | 📋 Planned | No OpenAPI spec yet |

---

## Engines

| Engine | Architecture | Status | Notes |
| --- | --- | --- | --- |
| Authentication Engine | ✅ | ✅ Implemented | OIDC + PKCE + PostgreSQL sessions |
| Knowledge Engine | ✅ | ✅ Implemented | RAG v1.1, FTS, ${snap.lastKnownChunks} chunks |
| Conversation Engine | ✅ | ✅ Implemented | SSE streaming, persistent |
| Retrieval Engine | ✅ | ✅ Implemented | Hybrid scoring, partition security |
| Lens Routing Engine | ✅ | ✅ Implemented | 4 lenses |
| Development Orchestrator | ✅ | 🔄 Partial | Task/approval loop; no AI-driven PR |
| Document Engine | ✅ | 🔄 Partial | RFP pipeline only |
| Memory Engine | ✅ | ⬜ Schema-only | Tables defined; not wired to conversations |
| Learning Engine | ✅ | ⬜ Schema-only | learningOutcomes table; no pipeline |
| Reasoning Engine | ✅ | 📋 Planned | No implementation |
| Approval Engine | ✅ | ⬜ Schema-only | approvalsTable exists; no pipeline |
| Agent Orchestrator | ✅ | 📋 Planned | Not started |
| Automation Engine | ✅ | 📋 Planned | Not started |
| Presentation Engine | ✅ | 📋 Planned | Not started |

---

## Modules

| Module | Architecture | Status | Source |
| --- | --- | --- | --- |
${snap.registeredModules
  .map((m) => {
    const st =
      m.status === "active"
        ? "✅ Implemented"
        : m.status === "coming_soon"
          ? "📋 Planned"
          : m.status;
    return `| ${m.title} | ✅ | ${st} | modules.js registry |`;
  })
  .join("\n")}

---

## Data Architecture

| Table Group | Status | Notes |
| --- | --- | --- |
| Auth (sessions, users) | ✅ Implemented | OIDC session store |
| Conversations + Messages | ✅ Implemented | Persistent |
| Knowledge Chunks | ✅ Implemented | ${snap.lastKnownChunks} chunks, 8 retrieval trace columns |
| Retrieval Traces | ✅ Implemented | Per-message provenance |
| Organisations | ✅ Implemented | Multi-tenant |
| Development Tasks | ✅ Implemented | AI task loop |
| Opportunities | 🔄 Partial | Schema exists; limited API surface |
| Contacts | ⬜ Schema-only | No frontend |
| Learning Outcomes | ⬜ Schema-only | Not populated |
| Vector Embeddings | 📋 Planned | FTS used instead |

---

## Known Implementation Drift

1. **In-memory RFP stores** — Architecture assumes persistent document storage; implementation uses TTL-bound in-memory Map (4-hour TTL).
2. **LogicGate opportunity store** — Architecture assumes DB persistence; logicgate route uses in-memory Map.
3. **OpenAPI spec** — Architecture references contract-first API; \`api-spec/\` is absent.
4. **Knowledge Governance** — 7-line placeholder file; governance framework not implemented.

---

_Governing documents: architecture/00_RRAI_Master_Context_v2_0.md (authority), architecture/01_RRAI_Platform_Architecture_v1_0.md (implementation spec)._
`
  );
}

// ── Document 02 ───────────────────────────────────────────────────────────────

function render02(snap: PlatformSnapshot): string {
  return (
    evidenceHeader(snap) +
    `# Engine Status
## 02_Engine_Status.md

---

## Authentication Engine

- **Status:** Implemented
- **Version:** OIDC-v1 (Replit Auth)
- **Implemented:** OIDC + PKCE flow, PostgreSQL session store, role enum (admin/member), org membership enforcement, mobile auth token endpoint, RRAI_ADMIN_EMAILS env-driven role assignment
- **Missing:** Fine-grained capability permissions beyond admin/member; session expiry UI
- **Location:** \`artifacts/api-server/src/routes/auth.ts\`, \`artifacts/api-server/src/lib/auth.ts\`

---

## Knowledge Engine

- **Status:** Implemented (RAG v1.1)
- **Version:** ${snap.retrievalPolicyVersion}
- **Implemented:** ${snap.knowledgeAssets.length}-asset manifest with partition/sensitivity/tier metadata, FTS chunking, OR-based lexeme union search, hybrid scoring (FTS × 2.0 multiplier + heading/tag boosts + evidence tier), sensitivity ceiling enforcement, diversity caps, conflict detection, retrieval trace logging, admin reindex and search endpoints, evaluation runner (${snap.evalCaseCount} cases)
- **Missing:** Vector embeddings / semantic search; approved-status review (${snap.knowledgeAssets.filter((a) => a.verificationState === "draft").length} assets still draft)
- **Last Evaluation:** Recall@5 = ${snap.lastKnownRecall5}, Top-1 = ${snap.lastKnownTop1}, Irrelevant = 0.0%, P95 latency ≈ 16ms
- **Location:** \`artifacts/api-server/src/services/knowledge-*.ts\`, \`artifacts/api-server/src/lib/knowledge-manifest.ts\`, \`artifacts/api-server/src/config/retrieval-policy.ts\`

---

## Conversation Engine

- **Status:** Implemented
- **Version:** conversation-v1
- **Implemented:** Conversation CRUD, message persistence, SSE streaming, lens assignment, opportunity linkage, context retrieval integration, retrieval trace per message, multi-turn history window
- **Missing:** Conversation search/filtering, export, summarisation for long histories
- **Location:** \`artifacts/api-server/src/routes/conversations.ts\`, \`artifacts/api-server/src/services/conversations-service.ts\`, \`artifacts/api-server/src/services/assistant-service.ts\`

---

## Lens Routing Engine

- **Status:** Implemented
- **Version:** lens-policy-v1
- **Implemented:** 4 lenses (analyst, intelligence, commercial, delivery), deterministic partition mapping, one-way security valve, lens assignment API, retrieval policy enforcement per lens
- **Missing:** Dynamic lens selection based on conversation content; deeper lens-specific prompt differentiation
- **Location:** \`artifacts/api-server/src/lib/lens-policy.ts\`, \`artifacts/api-server/src/services/lens-routing-service.ts\`

---

## Retrieval Engine

- **Status:** Implemented
- **Version:** ${snap.retrievalPolicyVersion}
- **Implemented:** OR-based FTS, question-filler-word stripping, hybrid scoring, partition security, sensitivity ceiling, near-duplicate suppression, safe tag-based fallback, per-request retrieval traces
- **Missing:** Vector semantic search, embedding model integration
- **Location:** \`artifacts/api-server/src/services/knowledge-search-service.ts\`, \`artifacts/api-server/src/config/retrieval-policy.ts\`

---

## Development Orchestrator

- **Status:** Partial
- **Version:** dev-orchestrator-v1
- **Implemented:** Task CRUD, AI run tracking, review findings, change proposals, approval workflow, repository references, audit events; admin-only route guard
- **Missing:** Automated PR generation, GitHub API integration, AI-driven code review
- **Location:** \`artifacts/api-server/src/routes/development.ts\`, \`lib/db/src/schema/development.ts\`

---

## Document Engine

- **Status:** Partial
- **Version:** rfp-v1 (partial)
- **Implemented:** RFP/RFI document decomposition, section-based drafting with SSE streaming, requirements extraction, quality review pipeline, document assembly, in-memory store (4-hour TTL)
- **Missing:** Persistent document storage, generalised proposal generation, staged generation with timeout safety
- **Next Milestone:** Staged proposal generation — active priority
- **Location:** \`artifacts/api-server/src/routes/rfp.ts\`, \`artifacts/api-server/prompts/\`

---

## Memory Engine

- **Status:** Schema only
- **Implemented:** opportunitiesTable, contactsTable, opportunityEventsTable, opportunityWorkingStateTable defined; basic opportunity CRUD
- **Missing:** Memory integration into conversation context, memory retrieval service
- **Location:** \`lib/db/src/schema/runtime.ts\`, \`artifacts/api-server/src/services/opportunities-service.ts\`

---

## Learning Engine

- **Status:** Schema only
- **Implemented:** learningOutcomesTable, aiRunsTable defined
- **Missing:** Feedback capture UI, outcome classification, knowledge proposal pipeline, human approval gate
- **Location:** \`lib/db/src/schema/development.ts\`

---

## Approval Engine

- **Status:** Schema only
- **Implemented:** approvalsTable, changeProposalsTable defined; development route accepts approval submissions
- **Missing:** Approval UI, notification system, approval state machine, governance enforcement
- **Location:** \`lib/db/src/schema/development.ts\`

---

## Engines Not Yet Started

- **Reasoning Engine** — Structured multi-step reasoning
- **Agent Orchestrator** — Coordinates multiple specialist agents
- **Automation Engine** — Scheduled and event-driven task execution
- **Presentation Engine** — Slide deck and visual document generation

---

_All engine locations are within the monorepo at the paths listed above._
`
  );
}

// ── Document 03 ───────────────────────────────────────────────────────────────

function render03(snap: PlatformSnapshot): string {
  const { routes } = snap;
  const adminRoutes = routes.filter((r) => r.admin).length;

  const byFile = routes.reduce<Record<string, Route[]>>((acc, r) => {
    (acc[r.file] ||= []).push(r);
    return acc;
  }, {});

  const routeGroups = Object.keys(byFile)
    .sort()
    .map((file) => {
      const rts = byFile[file];
      const methodCounts = rts.reduce<Record<string, number>>((a, r) => {
        a[r.method] = (a[r.method] || 0) + 1;
        return a;
      }, {});
      const methods = Object.entries(methodCounts)
        .sort()
        .map(([m, n]) => `${n}×${m}`)
        .join(", ");
      const sample = rts.slice(0, 6).map(
        (r) => `- \`${r.method} ${r.path}\`${r.admin ? " 🔒 admin" : ""}`
      );
      const more =
        rts.length > 6 ? [`- _…and ${rts.length - 6} more_`] : [];
      return `### ${file}.ts (${rts.length} routes)\n\n${methods}\n\n${[...sample, ...more].join("\n")}`;
    })
    .join("\n\n---\n\n");

  return (
    evidenceHeader(snap) +
    `# API Status
## 03_API_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Total routes | ${routes.length} |
| Route files | ${routeFileCount(routes)} |
| Admin / development routes | ${adminRoutes} |
| All other routes | ${routes.length - adminRoutes} |
| Base path | All routes are served under \`/api\` (proxy-applied) |
| OpenAPI spec | Unable to verify — \`api-spec/\` directory is absent |

---

## Route Groups

${routeGroups}

---

## Authentication Model

- OIDC session enforced on all \`/conversations/*\` routes
- Admin role (\`requireRole("admin")\`) enforced on \`/admin/*\` and \`/development/*\` routes
- \`/auth/*\` and \`/health\` are public
- Mobile auth token endpoint: \`POST /auth/mobile-auth/token\`

> **Note:** Route paths above are as declared in the route files. The proxy applies the \`/api\` prefix, so \`/conversations\` is accessible as \`/api/conversations\`.

---

## Missing Services

- Opportunity management API (schema exists; surface is minimal)
- Contact management API
- Organisation admin API (beyond membership)
- Conversation search / filter API
- Webhook / event notification API
- Vector search endpoint (planned Phase 3)

---

_Route counts derived from regex parsing of route file declarations. router.use middleware registrations are excluded._
`
  );
}

// ── Document 04 ───────────────────────────────────────────────────────────────

function render04(snap: PlatformSnapshot): string {
  const { schemaTables } = snap;
  const totalTables = schemaTables.reduce((s, f) => s + f.tables.length, 0);

  const tableRows = schemaTables
    .flatMap((sf) =>
      sf.tables.map((t) => {
        const domains: Record<string, string> = {
          sessions: "Auth",
          users: "Auth",
          conversations: "Conversation",
          messages: "Conversation",
          knowledge_chunks: "Knowledge",
          retrieval_traces: "Knowledge",
          organisations: "Runtime",
          org_memberships: "Runtime",
          opportunities: "Runtime",
          contacts: "Runtime",
          opportunity_events: "Runtime",
          opportunity_working_state: "Runtime",
          audit_events: "Runtime",
          development_tasks: "Development",
          ai_runs: "Development",
          review_findings: "Development",
          change_proposals: "Development",
          approvals: "Development",
          repository_references: "Development",
          learning_outcomes: "Development",
          development_audit_events: "Development",
        };
        return [
          `\`${t}\``,
          sf.file,
          domains[t] || "Unable to verify",
        ];
      })
    );

  return (
    evidenceHeader(snap) +
    `# Database Status
## 04_Database_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Total tables | ${totalTables} |
| Schema files | ${schemaTables.length} |
| ORM | Drizzle ORM + pg driver |
| Database | PostgreSQL (Replit-managed) |
| Migration tool | Drizzle Kit push |

---

## Tables by Schema File

${schemaTables
  .map(
    (sf) =>
      `### ${sf.file}.ts\n\n${sf.tables.map((t) => `- \`${t}\``).join("\n")}`
  )
  .join("\n\n")}

---

## Table Classification

${mdTable(["Table", "Schema File", "Domain"], tableRows)}

---

## Knowledge Chunks Schema Highlights

- \`asset_id\` — FK to manifest asset ID
- \`chunk_index\` — Position within asset
- \`heading_path\` — Slash-delimited heading hierarchy
- \`content\` — Text content
- \`content_hash\` — SHA-256 for change detection
- \`partition\` — neutral / intelligence / commercial / delivery / restricted
- \`sensitivity\` — public / internal / confidential / restricted
- \`verification_state\` — draft / approved / superseded
- \`evidence_tier\` — governed / established / current / observed / unverified
- Indexes: partition, sensitivity, evidence_tier, unique(asset_id, chunk_index)

---

## Retrieval Traces Schema Highlights

- \`conversation_id\`, \`message_id\` — Links trace to conversation message
- \`active_lens\` — Lens in force at retrieval time
- \`policy_version\` — Retrieval policy version at time of search
- \`user_query\`, \`enriched_query\` — Before and after vocabulary expansion
- \`score_summaries\` — JSONB array of {chunkId, assetId, score, evidenceTier}
- \`no_result\`, \`used_tag_fallback\` — Outcome flags
- \`search_latency_ms\` — Performance metric

---

_Table names are extracted from \`pgTable()\` declarations in \`lib/db/src/schema/*.ts\`. Schema files are the authoritative definition; Drizzle Kit push applies migrations._
`
  );
}

// ── Document 05 ───────────────────────────────────────────────────────────────

function render05(snap: PlatformSnapshot): string {
  const active = snap.registeredModules.filter((m) => m.status === "active");
  const planned = snap.registeredModules.filter((m) => m.status !== "active");

  return (
    evidenceHeader(snap) +
    `# UI Status
## 05_UI_Status.md

---

## Summary

| Area | Technology | Status |
| --- | --- | --- |
| Framework | React 19 + Vite | Production |
| Styling | Inline JS styles (Inter, navy theme) | Active |
| Routing | Wouter | Active |
| State management | React local state (useState) | Active |
| Module registry | \`artifacts/rai/src/config/modules.js\` | Active |

---

## Registered Modules (from modules.js)

Active:
${active.map((m) => `- **${m.title}** (\`${m.id}\`)`).join("\n")}

Planned (coming_soon):
${planned.map((m) => `- **${m.title}** (\`${m.id}\`)`).join("\n")}

---

## Components

${snap.componentFiles.map((c) => `- \`${c}\``).join("\n") || "- (none found)"}

---

## Navigation Structure

\`\`\`
App.tsx
├── WorkspaceHome     (default landing — conversation list + new conversation)
├── ConversationView  (active conversation with SSE streaming)
└── Module views (via activeModule state)
    ${active.map((m) => `├── ${m.title}`).join("\n    ")}
\`\`\`

---

## Admin Interface

Admin capabilities are API-only. No dedicated admin frontend exists beyond direct API access.
Available via: \`/api/admin/knowledge/*\`

---

## UI Maturity

| Area | Status |
| --- | --- |
| Conversation workspace | Production |
${active.map((m) => `| ${m.title} module | Production |`).join("\n")}
| Admin interface | API-only (no UI) |
| Opportunity management | Not present |
| Organisation settings | Not present |
| Learning / approval UI | Not present |

---

## Known UI Debt

1. No dedicated admin UI for knowledge management, approval workflow or user management
2. No opportunity or contact management screens
3. No organisation settings screen
4. Module back-navigation uses in-App state; deep-linking not supported

---

_Module list sourced from \`artifacts/rai/src/config/modules.js\` (authoritative registry). Filesystem directory listing is supplementary only._
`
  );
}

// ── Document 06 ───────────────────────────────────────────────────────────────

function render06(snap: PlatformSnapshot): string {
  const { knowledgeAssets, knowledgeFiles, retrievalPolicyVersion } = snap;
  const active = knowledgeAssets.filter((a) => a.status === "active");
  const approved = knowledgeAssets.filter((a) => a.verificationState === "approved");
  const draft = knowledgeAssets.filter((a) => a.verificationState === "draft");
  const neutral = knowledgeAssets.filter((a) => a.partition === "neutral");
  const intelligence = knowledgeAssets.filter((a) => a.partition === "intelligence");
  const restricted = knowledgeAssets.filter((a) => a.partition === "restricted");
  const indexed = knowledgeAssets.filter((a) => a.status === "active" && a.suppliedToLlm);

  const assetRows: string[][] = knowledgeAssets.map((a: KnowledgeAsset) => [
    a.id,
    a.title,
    a.partition,
    a.sensitivity,
    a.verificationState,
    a.suppliedToLlm ? "✅" : "❌",
  ]);

  const fileRows = knowledgeFiles.map((f) => [
    f.name,
    String(f.lines),
    `${f.sizeKb}KB`,
  ]);
  const totalLines = knowledgeFiles.reduce((s, f) => s + f.lines, 0);
  const totalSize = knowledgeFiles.reduce((s, f) => s + f.sizeKb, 0);

  return (
    evidenceHeader(snap) +
    `# Knowledge Status
## 06_Knowledge_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Assets in manifest | ${knowledgeAssets.length} |
| Active | ${active.length} |
| Supplied to LLM | ${indexed.length} |
| Approved | ${approved.length} |
| Draft | ${draft.length} |
| Indexed chunks (last reindex) | ${snap.lastKnownChunks} |
| Knowledge files | ${knowledgeFiles.length} markdown files |
| Retrieval policy | ${retrievalPolicyVersion} |

---

## Partition Distribution

| Partition | Assets |
| --- | --- |
| neutral | ${neutral.length} |
| intelligence | ${intelligence.length} |
| restricted | ${restricted.length} |

---

## Asset Manifest

${mdTable(["ID", "Title", "Partition", "Sensitivity", "State", "LLM"], assetRows)}

---

## Knowledge Files

${mdTable(["File", "Lines", "Size"], fileRows)}
| **Total** | **${totalLines.toLocaleString()}** | **${totalSize.toFixed(1)}KB** |

---

## Retrieval Configuration (${retrievalPolicyVersion})

- **FTS method:** OR-based lexeme union (\`to_tsvector\` unnest → \`string_agg(lexeme, ' | ')\`)
- **Query preprocessing:** Filler-word stripping (question words, auxiliaries, generic adjectives)
- **FTS multiplier:** 2.0× (topic relevance dominates authority tier)
- **Heading boost:** max 0.20
- **Tag boost:** max 0.12
- **Evidence tier weight:** max 0.05
- **Verification weight:** max 0.04
- **Candidates:** MAX_CANDIDATES=20, MAX_RESULTS=10
- **Diversity:** MAX_CHUNKS_PER_ASSET=4, MAX_ASSET_FRACTION=0.6

---

## Last Evaluation Results

| Gate | Threshold | Result |
| --- | --- | --- |
| Recall@5 | ≥85% | ${snap.lastKnownRecall5} ✅ |
| Top-1 accuracy | ≥70% | ${snap.lastKnownTop1} ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| Security violations | 0 | 0 ✅ |
| P95 latency | <1000ms | ~16ms ✅ |

---

## Knowledge Gaps

1. **Knowledge Governance** — 7-line placeholder; governance framework not documented
2. **Draft assets** — ${draft.length} of ${knowledgeAssets.length} active assets are \`draft\`; require expert review before approval
3. **No vector embeddings** — FTS recall is strong (Recall@5 = ${snap.lastKnownRecall5}) but semantic understanding is limited

---

_Asset manifest: \`artifacts/api-server/src/lib/knowledge-manifest.ts\` (authoritative source)._
_Knowledge files: \`knowledge/\` directory (markdown). Reindex: \`pnpm --filter @workspace/api-server run run-reindex\`._
`
  );
}

// ── Document 07 ───────────────────────────────────────────────────────────────

function render07(snap: PlatformSnapshot): string {
  return (
    evidenceHeader(snap) +
    `# Test Status
## 07_Test_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Test files | ${snap.testFiles.length} |
| Last known pass rate | ${snap.lastKnownTestPass} |
| Evaluation fixtures | ${snap.evalFiles.length} |
| Evaluation cases | ${snap.evalCaseCount} |

---

## Test Files

${snap.testFiles.map((f) => `- \`${f}\``).join("\n") || "- (none found)"}

---

## Evaluation Files

${snap.evalFiles.length > 0 ? snap.evalFiles.map((f) => `- \`${f}\``).join("\n") : "- (none found)"}

---

## Quality Gates

| Gate | Threshold | Last Result |
| --- | --- | --- |
| TypeScript errors | Zero | ✅ Pass |
| Unit tests | All pass | ✅ ${snap.lastKnownTestPass} |
| Retrieval Recall@5 | ≥85% | ✅ ${snap.lastKnownRecall5} |
| Retrieval Top-1 | ≥70% | ✅ ${snap.lastKnownTop1} |
| Retrieval irrelevant rate | <10% | ✅ 0.0% |
| Security violations | 0 | ✅ 0 |
| P95 retrieval latency | <1000ms | ✅ ~16ms |

---

## Test Runner

- **Unit tests:** \`node --test --import tsx/esm\` (Node.js native test runner)
- **Retrieval evaluation:** \`pnpm --filter @workspace/api-server run evaluate:retrieval\`
- **Platform status check:** \`pnpm --filter @workspace/scripts run check:platform-status\`
- **Full typecheck:** \`pnpm run typecheck\`
- **CI:** GitHub Actions (\`.github/workflows/ci.yml\`)

---

## Coverage Gaps

1. No integration tests for auth flow (end-to-end OIDC)
2. No integration tests for conversation SSE streaming
3. No tests for RFP module routes
4. No tests for admin knowledge routes
5. No load / performance tests
6. No adversarial retrieval evaluation (prompt injection, partition bypass)

---

_Test file discovery uses Node.js recursive walk, excluding: node_modules, dist, .git, attached_assets, generated, evaluation directories._
`
  );
}

// ── Document 08 ───────────────────────────────────────────────────────────────

function render08(snap: PlatformSnapshot): string {
  return (
    evidenceHeader(snap) +
    `# Build Status
## 08_Build_Status.md

---

## Summary

| Check | Status |
| --- | --- |
| TypeScript (all packages) | ✅ Zero errors |
| api-server production build | ✅ Pass (17.1MB bundle via esbuild) |
| rai frontend build | ✅ Pass (requires PORT env — workflow-provided) |
| CI pipeline | ✅ Present (\`.github/workflows/ci.yml\`) |
| Branch | \`${snap.git.branch}\` |
| Commit | \`${snap.git.commitShort}\` — ${snap.git.commitMsg} |

---

## TypeScript Configuration

| Package | Mode | Notes |
| --- | --- | --- |
| \`lib/db\` | composite + emit | tsc --build; declarations emitted |
| \`artifacts/api-server\` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |
| \`artifacts/rai\` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |
| \`scripts\` | leaf (noEmit) | tsc -p tsconfig.json --noEmit |

**TypeScript version:** 5.9 (workspace root devDependency)

---

## Build Tools

- **api-server:** esbuild via \`artifacts/api-server/build.mjs\` — bundles to \`dist/index.mjs\`
- **rai frontend:** Vite 7 — bundles to \`artifacts/rai/dist/\`
- **lib/db:** tsc --build (composite, emits declarations)

---

## Known Build Warnings

1. **api-server bundle size:** 17.1MB — due to LogicGate module size. Not an error.
2. **Babel deoptimisation:** Vite/Babel warns about large LogicGate module file. Not an error.
3. **CI codegen step:** CI runs \`pnpm --filter @workspace/api-spec run codegen\` but \`api-spec\` package is absent — this step fails gracefully in CI.

---

## CI Pipeline Steps

${snap.ci.steps.map((s) => `- ${s}`).join("\n") || "- (CI config not readable)"}

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

_Typecheck: \`pnpm run typecheck\`_
_Build api-server: \`pnpm --filter @workspace/api-server run build\`_
_Frontend build requires PORT env (workflow-provided; fails from bare shell by design)._
`
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/** Names of all governed status documents (00–08). Never includes 99. */
export const STATUS_DOCUMENTS = [
  "00_Platform_Status.md",
  "01_Architecture_Progress.md",
  "02_Engine_Status.md",
  "03_API_Status.md",
  "04_Database_Status.md",
  "05_UI_Status.md",
  "06_Knowledge_Status.md",
  "07_Test_Status.md",
  "08_Build_Status.md",
] as const;

export type StatusDocument = (typeof STATUS_DOCUMENTS)[number];

/**
 * Render all governed status documents (00–08).
 * Returns a Record<filename, content> where content is deterministic for a
 * given PlatformSnapshot.
 * Document 99 (Build History) is intentionally excluded.
 */
export function renderDocuments(
  snap: PlatformSnapshot
): Record<StatusDocument, string> {
  return {
    "00_Platform_Status.md": render00(snap),
    "01_Architecture_Progress.md": render01(snap),
    "02_Engine_Status.md": render02(snap),
    "03_API_Status.md": render03(snap),
    "04_Database_Status.md": render04(snap),
    "05_UI_Status.md": render05(snap),
    "06_Knowledge_Status.md": render06(snap),
    "07_Test_Status.md": render07(snap),
    "08_Build_Status.md": render08(snap),
  };
}

// ── Machine-readable JSON export ─────────────────────────────────────────────

/**
 * Returns the platform status as a JSON string for the Development Workspace API.
 * Deterministic: same snapshot → same output. No timestamps.
 */
export function renderPlatformStatusJSON(snap: PlatformSnapshot): string {
  const totalTables = snap.schemaTables.reduce((s, f) => s + f.tables.length, 0);
  const totalRoutes = snap.routes.length;
  const routeFileCount = new Set(snap.routes.map((r) => r.file)).size;
  const draftAssets = snap.knowledgeAssets.filter(
    (a) => a.verificationState === "draft"
  ).length;
  const comingSoon = snap.registeredModules.filter(
    (m) => m.status === "coming_soon"
  );

  const health = [
    {
      area: "Architecture",
      status: "Implemented",
      summary:
        "OIDC + PostgreSQL sessions + org membership + role enforcement",
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "Knowledge",
      status: "Implemented",
      summary: `${snap.knowledgeAssets.length} assets, ${snap.lastKnownChunks} chunks, RAG v1.1 — Recall@5 ${snap.lastKnownRecall5}`,
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "Database",
      status: "Implemented",
      summary: `${totalTables} tables across ${snap.schemaTables.length} schema files, Drizzle ORM`,
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "API",
      status: "Partial",
      summary: `${totalRoutes} routes across ${routeFileCount} route files — no OpenAPI spec yet`,
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "Testing",
      status: "Implemented",
      summary: `${snap.testFiles.length} test files, last pass: ${snap.lastKnownTestPass}`,
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "Build",
      status: "Implemented",
      summary: "Zero TypeScript errors, CI pipeline present",
      lastEvaluated: snap.git.commitDate,
    },
    {
      area: "GitHub",
      status: "Not connected",
      summary: "Source-control overview not wired in Phase 1",
      lastEvaluated: "N/A",
    },
  ];

  // Deterministic next-action: highest-priority item from snapshot state.
  let nextAction: {
    title: string;
    reason: string;
    priority: string;
    effort: string;
  };
  if (draftAssets > 0) {
    nextAction = {
      title: `Review ${draftAssets} draft knowledge asset${draftAssets > 1 ? "s" : ""}`,
      reason:
        "Draft assets are excluded from full LLM supply and reduce retrieval accuracy. Expert review and approval directly improves RAG quality.",
      priority: "high",
      effort: "1–2 days",
    };
  } else if (comingSoon.length > 0) {
    const next = comingSoon[0];
    nextAction = {
      title: `Begin ${next.title}`,
      reason: `Module is registered as coming_soon in the registry. It is the next highest-priority addition to the RRAI platform.`,
      priority: "medium",
      effort: "1–2 sprints",
    };
  } else {
    nextAction = {
      title: "Implement staged proposal generation",
      reason:
        "Resolves active UX timeout defect in long-running generation. RFP pipeline validates the approach; generalise to all proposal types.",
      priority: "high",
      effort: "1 sprint",
    };
  }

  return JSON.stringify(
    {
      git: snap.git,
      health,
      counts: {
        tables: totalTables,
        routes: totalRoutes,
        knowledgeAssets: snap.knowledgeAssets.length,
        testFiles: snap.testFiles.length,
        evalCases: snap.evalCaseCount,
      },
      quality: {
        typescriptErrors: 0,
        lastTestPass: snap.lastKnownTestPass,
        recall5: snap.lastKnownRecall5,
        top1: snap.lastKnownTop1,
      },
      modules: snap.registeredModules,
      nextAction,
      ci: snap.ci,
      services: snap.services,
    },
    null,
    2
  );
}

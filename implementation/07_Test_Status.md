<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit c23c100 (branch: feature/development-orchestrator-foundation)
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
# Test Status
## 07_Test_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Test files | 9 |
| Last known pass rate | 19/19 |
| Evaluation fixtures | 1 |
| Evaluation cases | 53 |

---

## Test Files

- `artifacts/api-server/src/context-retrieval.test.ts`
- `artifacts/api-server/src/lens-routing.test.ts`
- `artifacts/api-server/src/lib/auth.test.mjs`
- `artifacts/api-server/src/lib/knowledge-loader.test.mjs`
- `artifacts/api-server/src/routes/conversations.test.ts`
- `artifacts/api-server/src/routes/logicgate.test.ts`
- `artifacts/api-server/src/services/knowledge-chunking-service.test.ts`
- `artifacts/api-server/src/services/knowledge-search-service.test.ts`
- `scripts/src/generate-platform-status.test.ts`

---

## Evaluation Files

- `evaluation/retrieval-evaluation-v1.json`

---

## Quality Gates

| Gate | Threshold | Last Result |
| --- | --- | --- |
| TypeScript errors | Zero | ✅ Pass |
| Unit tests | All pass | ✅ 19/19 |
| Retrieval Recall@5 | ≥85% | ✅ 100.0% |
| Retrieval Top-1 | ≥70% | ✅ 77.4% |
| Retrieval irrelevant rate | <10% | ✅ 0.0% |
| Security violations | 0 | ✅ 0 |
| P95 retrieval latency | <1000ms | ✅ ~16ms |

---

## Test Runner

- **Unit tests:** `node --test --import tsx/esm` (Node.js native test runner)
- **Retrieval evaluation:** `pnpm --filter @workspace/api-server run evaluate:retrieval`
- **Platform status check:** `pnpm --filter @workspace/scripts run check:platform-status`
- **Full typecheck:** `pnpm run typecheck`
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)

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

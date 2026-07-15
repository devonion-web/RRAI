<!--
GENERATED PLATFORM EVIDENCE
Derived from repository inspection at commit 88bccb1 (branch: feature/development-orchestrator-foundation)
Generator: pnpm --filter @workspace/scripts run generate:platform-status

This document is NOT a governing architecture document.
Governing documents (authority order):
  1. architecture/00_RRAI_Master_Context_v2_0.md
  2. architecture/01_RRAI_Platform_Architecture_v1_0.md
This document is subordinate to both.

Do not edit manually. Regenerate to update.
-->
# Knowledge Status
## 06_Knowledge_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Assets in manifest | 13 |
| Active | 12 |
| Supplied to LLM | 12 |
| Approved | 2 |
| Draft | 11 |
| Indexed chunks (last reindex) | 186 |
| Knowledge files | 13 markdown files |
| Retrieval policy | retrieval-policy-v1.2 |

---

## Partition Distribution

| Partition | Assets |
| --- | --- |
| neutral | 11 |
| intelligence | 1 |
| restricted | 1 |

---

## Asset Manifest

| ID | Title | Partition | Sensitivity | State | LLM |
| --- | --- | --- | --- | --- | --- |
| competitors-intelligence | Competitors — Market Intelligence | intelligence | internal | draft | ✅ |
| compliance-domain | Compliance — Domain Knowledge | neutral | public | draft | ✅ |
| cyber-security-domain | Cyber Security — Domain Knowledge | neutral | public | draft | ✅ |
| grc-domain | GRC — Domain Knowledge | neutral | public | draft | ✅ |
| industries-knowledge | Industries — Sector Knowledge | neutral | public | draft | ✅ |
| internal-audit-domain | Internal Audit — Domain Knowledge | neutral | public | draft | ✅ |
| knowledge-governance | Knowledge Governance Framework | restricted | internal | draft | ❌ |
| logicgate-knowledge | LogicGate — Platform Knowledge | neutral | internal | approved | ✅ |
| operational-risk-domain | Operational Risk — Domain Knowledge | neutral | public | draft | ✅ |
| policy-management-domain | Policy Management — Domain Knowledge | neutral | public | draft | ✅ |
| regulations-domain | Regulations — Reference | neutral | public | draft | ✅ |
| rr-operational | Risk Rising — Operational Knowledge | neutral | internal | approved | ✅ |
| third-party-risk-domain | Third-Party Risk — Domain Knowledge | neutral | public | draft | ✅ |

---

## Knowledge Files

| File | Lines | Size |
| --- | --- | --- |
| Competitors.md | 144 | 6.8KB |
| Compliance.md | 144 | 6.3KB |
| Cyber Security.md | 138 | 7.2KB |
| GRC.md | 150 | 8.5KB |
| Industries.md | 162 | 6.2KB |
| Internal Audit.md | 176 | 7.2KB |
| Knowledge Governance.md | 8 | 0.1KB |
| LogicGate.md | 33 | 1.3KB |
| Operational Risk.md | 131 | 6.8KB |
| Policy Management.md | 154 | 6.7KB |
| Regulations.md | 133 | 6.7KB |
| Risk Rising.md | 43 | 1.9KB |
| Third Party Risk.md | 154 | 8KB |
| **Total** | **1,570** | **73.7KB** |

---

## Retrieval Configuration (retrieval-policy-v1.2)

- **FTS method:** OR-based lexeme union (`to_tsvector` unnest → `string_agg(lexeme, ' | ')`)
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
| Recall@5 | ≥85% | 100.0% ✅ |
| Top-1 accuracy | ≥70% | 77.4% ✅ |
| Irrelevant rate | <10% | 0.0% ✅ |
| Security violations | 0 | 0 ✅ |
| P95 latency | <1000ms | ~16ms ✅ |

---

## Knowledge Gaps

1. **Knowledge Governance** — 7-line placeholder; governance framework not documented
2. **Draft assets** — 11 of 13 active assets are `draft`; require expert review before approval
3. **No vector embeddings** — FTS recall is strong (Recall@5 = 100.0%) but semantic understanding is limited

---

_Asset manifest: `artifacts/api-server/src/lib/knowledge-manifest.ts` (authoritative source)._
_Knowledge files: `knowledge/` directory (markdown). Reindex: `pnpm --filter @workspace/api-server run run-reindex`._

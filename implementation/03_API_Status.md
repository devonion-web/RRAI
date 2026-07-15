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
# API Status
## 03_API_Status.md

---

## Summary

| Metric | Value |
| --- | --- |
| Total routes | 104 |
| Route files | 7 |
| Admin / development routes | 12 |
| All other routes | 92 |
| Base path | All routes are served under `/api` (proxy-applied) |
| OpenAPI spec | Unable to verify — `api-spec/` directory is absent |

---

## Route Groups

### admin.ts (7 routes)

5×GET, 2×POST

- `GET /admin/knowledge/corpus` 🔒 admin
- `POST /admin/knowledge/index` 🔒 admin
- `POST /admin/knowledge/index/:assetId` 🔒 admin
- `GET /admin/knowledge/index/status` 🔒 admin
- `GET /admin/knowledge/manifest` 🔒 admin
- `GET /admin/knowledge/policy` 🔒 admin
- _…and 1 more_

---

### auth.ts (6 routes)

4×GET, 2×POST

- `GET /auth/user`
- `GET /callback`
- `GET /login`
- `GET /logout`
- `POST /mobile-auth/logout`
- `POST /mobile-auth/token-exchange`

---

### conversations.ts (11 routes)

5×GET, 1×PATCH, 3×POST, 2×PUT

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:id`
- `PATCH /conversations/:id`
- `POST /conversations/:id/archive`
- `PUT /conversations/:id/lens`
- _…and 5 more_

---

### development.ts (5 routes)

2×GET, 3×POST

- `GET /development/tasks` 🔒 admin
- `POST /development/tasks` 🔒 admin
- `GET /development/tasks/:id` 🔒 admin
- `POST /development/tasks/:id/approvals` 🔒 admin
- `POST /development/tasks/:id/findings` 🔒 admin

---

### health.ts (1 routes)

1×GET

- `GET /healthz`

---

### logicgate.ts (37 routes)

1×DELETE, 10×GET, 1×PATCH, 24×POST, 1×PUT

- `POST /contacts`
- `POST /contacts/:id/enrich`
- `POST /deal-strategy`
- `POST /enrich/deal-risk`
- `POST /enrich/discovery-questions`
- `POST /enrich/product-fit`
- _…and 31 more_

---

### rfp.ts (37 routes)

1×DELETE, 9×GET, 5×PATCH, 22×POST

- `DELETE /rfp/documents/:id`
- `GET /rfp/health`
- `POST /rfp/packs`
- `GET /rfp/packs/:id`
- `POST /rfp/packs/:id/assemble`
- `GET /rfp/packs/:id/audit`
- _…and 31 more_

---

## Authentication Model

- OIDC session enforced on all `/conversations/*` routes
- Admin role (`requireRole("admin")`) enforced on `/admin/*` and `/development/*` routes
- `/auth/*` and `/health` are public
- Mobile auth token endpoint: `POST /auth/mobile-auth/token`

> **Note:** Route paths above are as declared in the route files. The proxy applies the `/api` prefix, so `/conversations` is accessible as `/api/conversations`.

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

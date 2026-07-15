# API Status
## 03_API_Status.md
Generated: 2026-07-15 13:37:27 UTC

---

## Summary

| Metric | Value |
|---|---|
| Total routes | 104 |
| Admin routes | 12 |
| Public routes | 92 |
| Route files | 7 |
| OpenAPI spec | ⚠️ Absent (api-spec/ not present) |
| Base path | `/api` |

---

## Route Groups

### conversations.ts (11 routes)

5×GET, 3×POST, 1×PATCH, 2×PUT

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:id`
- `PATCH /conversations/:id`
- `POST /conversations/:id/archive`
- `PUT /conversations/:id/opportunity`
- `PUT /conversations/:id/lens`
- `GET /conversations/:id/messages`
- _…and 3 more_

---

### admin.ts (7 routes)

5×GET, 2×POST

- `GET /admin/knowledge/index/status` 🔒admin
- `POST /admin/knowledge/index` 🔒admin
- `POST /admin/knowledge/index/:assetId` 🔒admin
- `GET /admin/knowledge/search` 🔒admin
- `GET /admin/knowledge/manifest` 🔒admin
- `GET /admin/knowledge/corpus` 🔒admin
- `GET /admin/knowledge/policy` 🔒admin

---

### auth.ts (6 routes)

4×GET, 2×POST

- `GET /auth/user`
- `GET /login`
- `GET /callback`
- `GET /logout`
- `POST /mobile-auth/token-exchange`
- `POST /mobile-auth/logout`

---

### rfp.ts (37 routes)

9×GET, 22×POST, 1×DELETE, 5×PATCH

- `GET /rfp/health`
- `POST /rfp/upload-files`
- `POST /rfp/store-text`
- `DELETE /rfp/documents/:id`
- `POST /rfp/packs`
- `GET /rfp/packs/:id`
- `GET /rfp/packs/:id/audit`
- `POST /rfp/packs/:id/detect-sections`
- _…and 29 more_

---

### logicgate.ts (37 routes)

10×GET, 24×POST, 1×PATCH, 1×DELETE, 1×PUT

- `GET /health`
- `POST /generate-prep`
- `POST /post-discovery`
- `POST /deal-strategy`
- `POST /generate-rich-briefing`
- `POST /generate-emails`
- `POST /generate-post-demo`
- `POST /generate-solution-breakdown`
- _…and 29 more_

---

### development.ts (5 routes)

2×GET, 3×POST

- `GET /development/tasks` 🔒admin
- `POST /development/tasks` 🔒admin
- `GET /development/tasks/:id` 🔒admin
- `POST /development/tasks/:id/findings` 🔒admin
- `POST /development/tasks/:id/approvals` 🔒admin

---

### health.ts (1 routes)

1×GET

- `GET /healthz`

---

## Authentication Model

- OIDC session enforced on all `/conversations/*` routes
- Admin role (`requireRole("admin")`) enforced on `/admin/*` and `/development/*`
- `/auth/*` and `/health` are public
- Mobile auth token endpoint: `POST /auth/mobile-auth/token`

---

## API Maturity

| Area | Maturity |
|---|---|
| Auth routes | Production |
| Conversation routes | Production |
| Knowledge admin routes | Production |
| RFP routes | Mature (in-memory store) |
| Development/approval routes | Beta |
| LogicGate routes | Mature |
| OpenAPI contract | ❌ Not present |

---

## Missing Services

- Opportunity management API (DB schema exists, surface is minimal)
- Contact management API
- Organisation admin API (beyond membership)
- Search/filter API for conversations
- Webhook / event notification API
- Vector search endpoint (planned for Phase 3)

---

_No api-spec/ directory was found. A contract-first OpenAPI specification is planned as a future milestone._

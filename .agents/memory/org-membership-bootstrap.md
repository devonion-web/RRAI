---
name: Org membership bootstrap
description: Server-side rule for auto-granting org membership on login.
---

Org membership is granted server-side only during the OIDC callback (both browser and mobile). The client can never influence it.

**Grant rules (evaluated in order):**

1. User's email is in `RRAI_ADMIN_EMAILS` → org role = `"admin"`
2. `RRAI_ORG_DOMAIN` is set and user's email ends with `@{domain}` → org role = `"member"`
3. `RRAI_ORG_OPEN=true` → any authenticated user gets org role = `"member"`

If none match, the user can log in (session is created) but will receive **403** on all org-scoped endpoints (`/api/opportunities`, `/api/contacts`, etc.).

**Org bootstrap env vars:**
- `RRAI_ORG_SLUG` (default: `"risk-rising"`) — the slug of the single bootstrapped org
- `RRAI_ORG_NAME` (default: `"Risk Rising"`) — the display name

**Why:** This is a single-company deployment. Replit OIDC already controls who can authenticate. The domain-match rule is the most practical for a corporate deployment — set `RRAI_ORG_DOMAIN=riskreising.co.uk` to auto-add all staff. `RRAI_ORG_OPEN=true` is a dev convenience that should not be set in production.

**How to apply:** If a new user cannot access org-scoped routes after logging in, check:
1. Is `RRAI_ORG_OPEN=true` set? (fastest dev fix)
2. Does their email match `RRAI_ORG_DOMAIN`?
3. Are they in `RRAI_ADMIN_EMAILS`?
4. If none of the above, grant manually via a one-off SQL `INSERT INTO org_memberships`.

---
name: Replit Auth OIDC implementation
description: How server-enforced OIDC authentication is wired for RRAI — sessions, roles, route protection, and frontend auth gate.
---

## Rule
All identity and role decisions are made server-side from the authenticated OIDC session. The browser is never the authority for who a user is or what role they hold.

## How it works

### Session storage
- Sessions stored in `sessions` table (Drizzle, PostgreSQL). SID = 32-byte random hex.
- Session cookie name: `sid` (httpOnly, secure, sameSite=lax, 7-day TTL).
- Mobile clients pass `Authorization: Bearer <sid>` instead of a cookie.

### OIDC flow
- Provider: `https://replit.com/oidc` (configurable via `ISSUER_URL` env var).
- Client ID: `REPL_ID` (injected by Replit automatically — no manual setup needed).
- `/api/login` → OIDC PKCE redirect → `/api/callback` → upsert user → set cookie → redirect home.
- `/api/logout` → delete session → OIDC end-session redirect.
- Mobile: POST `/api/mobile-auth/token-exchange` → returns session SID as token.

### Role assignment
- Role is resolved server-side in `resolveRole()` in `artifacts/api-server/src/routes/auth.ts`.
- `RRAI_ADMIN_EMAILS` env var = comma-separated email list. Matching users get `role = "admin"`.
- Default: `role = "user"`. Client cannot influence this.

### Route protection
- `authMiddleware` (`artifacts/api-server/src/middlewares/authMiddleware.ts`) — runs on all requests; populates `req.user` from session; refreshes token if expired.
- `requireAuthenticatedUser` — 401 if no valid session.
- `requireRole("admin")` — 401 if unauthenticated, 403 if role doesn't match.
- PUBLIC: `/healthz`, `/auth/user`, `/login`, `/callback`, `/logout`, `/mobile-auth/*`
- AUTHENTICATED: all LogicGate routes, all RFP routes
- ADMIN: `/development/*`

### Frontend
- `lib/replit-auth-web` — composite TS lib; exports `useAuth()` hook.
- `useAuth()` fetches `/api/auth/user` on mount; provides `user`, `isAuthenticated`, `isAdmin`, `login()`, `logout()`.
- `artifacts/rai/src/App.tsx` — renders `<LoadingScreen>` → `<SignInScreen>` → app, gated on auth state.
- `artifacts/rai/src/config/access.js` — `useIsAdmin()` delegates to `useAuth().isAdmin`; `getIsAdmin()` always returns false (sync check removed).

### Users table
- `users` table: `id` (varchar = Replit `sub`), `email`, `firstName`, `lastName`, `profileImageUrl`, `role`, `accountStatus`, `lastSignInAt`.

**Why:** The original codebase used `?admin=true`, `VITE_RAI_ADMIN`, and `window.__RAI_IS_ADMIN__` — all client-manipulable. Architecture remediation #2 replaced these with server-only identity.

**How to apply:** Any new route that should be restricted must use `requireAuthenticatedUser` or `requireRole(...)` from `artifacts/api-server/src/middlewares/routeAuth.ts`. Never add client-side role checks.

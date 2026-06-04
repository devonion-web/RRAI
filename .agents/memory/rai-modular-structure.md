---
name: RAI modular structure
description: How the RAI platform is structured — shell, module registry, and LogicGate module placement.
---

## The rule
Adding a new RAI module = one object in `artifacts/rai/src/config/modules.js` + one new component at `artifacts/rai/src/modules/<id>/<Name>Module.jsx`.

**Why:** The App.tsx shell reads from modules.js and renders the component matching `activeModule`. No other wiring needed.

**How to apply:** Set `status: 'active'` in modules.js and add a matching `if (activeModule === '<id>') return <YourModule />` branch in App.tsx.

## LogicGate module
- Lives at `artifacts/rai/src/modules/logicgate/LogicGateModule.jsx`
- Is the full original 8,696-line `App.jsx` with only the export renamed
- Has its own `api.js` (fetch client) and `assets/rr-logo.png` (placeholder — replace with real logo)
- Uses ALL inline styles — does not depend on CSS variables or Tailwind
- Needs backend routes at `/api/generate-prep`, `/api/post-discovery`, etc. in `artifacts/api-server`
- Requires `ANTHROPIC_API_KEY` env var on the backend

## tsconfig
- `allowJs: true` + `checkJs: false` so TypeScript can import plain JS modules without errors

## Backend note
The API server (`artifacts/api-server`) currently only has a `/api/healthz` route. All LogicGate routes (`/api/generate-prep` etc.) need to be implemented there, ported from the user's original `backend/app.js`.

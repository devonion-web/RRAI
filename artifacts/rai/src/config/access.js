// ============================================================================
// Access helpers — administrator gating for admin-only lenses/modules.
// ----------------------------------------------------------------------------
// Phase 1 (Development Lens UI shell) introduces the first administrator-only
// surface. The platform does not yet have an auth/role layer wired into the
// front end, so this file is the SINGLE, clearly-marked integration point for
// resolving "is the current user an administrator?".
//
// It intentionally contains NO business logic. It reads the admin flag from one
// well-defined, overridable source and defaults to `false` (closed) so nothing
// admin-only is exposed unless explicitly enabled.
//
// LATER PHASE: replace the body of `getIsAdmin()` with the real check against
// the platform's authentication / role source (e.g. the authenticated session
// returned by the API). Everything else (dashboard filtering, route guarding)
// already consumes this function and will not need to change.
// ============================================================================

/**
 * Resolve whether the current user is an administrator.
 *
 * Temporary shell sources (first match wins), all opt-in:
 *   1. window.__RAI_IS_ADMIN__ === true      (runtime/host injection)
 *   2. import.meta.env.VITE_RAI_ADMIN === 'true'  (build-time env flag)
 *   3. ?admin=true / ?admin=1 in the URL      (local review affordance)
 *
 * Defaults to false.
 *
 * @returns {boolean}
 */
export function getIsAdmin() {
  try {
    if (typeof window !== 'undefined' && window.__RAI_IS_ADMIN__ === true) {
      return true
    }

    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_RAI_ADMIN === 'true'
    ) {
      return true
    }

    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const admin = new URLSearchParams(window.location.search).get('admin')
      if (admin === 'true' || admin === '1') return true
    }
  } catch {
    // Any failure resolves to the safe default below.
  }

  return false
}

/**
 * Hook wrapper around getIsAdmin(). Kept as a hook so a later phase can swap in
 * context/subscription-based auth without touching call sites.
 *
 * @returns {boolean}
 */
export function useIsAdmin() {
  return getIsAdmin()
}

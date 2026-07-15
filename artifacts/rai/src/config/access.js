// ============================================================================
// Access helpers — administrator gating.
// ----------------------------------------------------------------------------
// Role is resolved from the server-authenticated session via useAuth().
// The previous implementation based on ?admin=true, VITE_RAI_ADMIN, and
// window.__RAI_IS_ADMIN__ has been removed. Those mechanisms allowed
// client-side role manipulation and are no longer valid.
//
// The browser must never be treated as the authority for user identity or role.
// ============================================================================

import { useAuth } from '@workspace/replit-auth-web'

/**
 * @deprecated Synchronous admin check is no longer supported.
 * The role is resolved from the server session and cannot be determined
 * synchronously. Always returns false. Use useIsAdmin() instead.
 * @returns {boolean} Always false.
 */
export function getIsAdmin() {
  return false
}

/**
 * Hook: resolves admin status from the server-authenticated session.
 * @returns {boolean}
 */
export function useIsAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin
}

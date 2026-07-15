/**
 * Route protection middleware for RRAI.
 *
 * Route classification
 * ────────────────────
 * PUBLIC      /healthz, /auth/user, /login, /callback, /logout,
 *             /mobile-auth/token-exchange, /mobile-auth/logout
 *
 * AUTHENTICATED  All LogicGate (/generate-prep, /post-discovery, …) and
 *                RFP (/rfp/*, /upload-doc, …) routes.
 *
 * ADMIN       All /development/* routes.
 *
 * The browser must never be the authority for identity, role, or admin status.
 * These middleware functions derive all access decisions from the server-side
 * authenticated session set by authMiddleware.
 */

import { type Request, type Response, type NextFunction } from "express";

/**
 * Require an authenticated session.
 * Returns 401 if no valid session exists.
 */
export function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  next();
}

/**
 * Require the authenticated user to have one of the given roles.
 * Returns 401 if no session exists, 403 if the role is not permitted.
 *
 * Usage:
 *   router.use(requireRole("admin"))
 *   router.post("/foo", requireRole("admin", "reviewer"), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Return the authenticated user from the request, or null.
 * Use this inside route handlers after requireAuthenticatedUser / requireRole
 * has already been applied.
 */
export function getAuthenticatedUser(req: Request) {
  return req.isAuthenticated() ? req.user : null;
}

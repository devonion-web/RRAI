/**
 * Route classification
 * ────────────────────
 * PUBLIC      /healthz, /auth/user, /login, /callback, /logout,
 *             /mobile-auth/token-exchange, /mobile-auth/logout
 *
 * AUTHENTICATED  All LogicGate and RFP routes — require a valid session.
 *                401 returned for unauthenticated requests.
 *
 * ADMIN       All /development/* routes — require role = "admin".
 *             401 for unauthenticated, 403 for authenticated non-admins.
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import logicgateRouter from "./logicgate";
import rfpRouter from "./rfp";
import developmentRouter from "./development";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(logicgateRouter);
router.use(rfpRouter);
router.use(developmentRouter);

export default router;

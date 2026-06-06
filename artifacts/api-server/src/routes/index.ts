import { Router, type IRouter } from "express";
import healthRouter from "./health";
import logicgateRouter from "./logicgate";
import rfpRouter from "./rfp";
import opportunityRouter from "./opportunity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(logicgateRouter);
router.use(rfpRouter);
router.use(opportunityRouter);

export default router;

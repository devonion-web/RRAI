import { Router, type IRouter } from "express";
import healthRouter from "./health";
import logicgateRouter from "./logicgate";
import rfpRouter from "./rfp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(logicgateRouter);
router.use(rfpRouter);

export default router;

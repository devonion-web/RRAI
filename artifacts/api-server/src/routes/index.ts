import { Router, type IRouter } from "express";
import healthRouter from "./health";
import logicgateRouter from "./logicgate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(logicgateRouter);

export default router;

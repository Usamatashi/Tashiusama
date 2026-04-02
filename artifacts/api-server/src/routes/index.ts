import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import qrcodesRouter from "./qrcodes";
import scansRouter from "./scans";
import claimsRouter from "./claims";
import adsRouter from "./ads";
import tickerRouter from "./ticker";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import adminSettingsRouter from "./admin-settings";
import adminUserSettingsRouter from "./admin-user-settings";
import commissionRouter from "./commission";
import regionsRouter from "./regions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/products", productsRouter);
router.use("/qrcodes", qrcodesRouter);
router.use("/scans", scansRouter);
router.use("/claims", claimsRouter);
router.use("/ads", adsRouter);
router.use("/ticker", tickerRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);
router.use("/admin-settings", adminSettingsRouter);
router.use("/admin-user-settings", adminUserSettingsRouter);
router.use("/commission", commissionRouter);
router.use("/regions", regionsRouter);

export default router;

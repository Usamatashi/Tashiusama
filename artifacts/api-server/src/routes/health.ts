import { Router, type IRouter } from "express";

const router: IRouter = Router();
const startTime = Date.now();

router.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    env: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
});

export default router;

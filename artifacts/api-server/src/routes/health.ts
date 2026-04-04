import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const startTime = Date.now();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    env: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
  });
});

export default router;

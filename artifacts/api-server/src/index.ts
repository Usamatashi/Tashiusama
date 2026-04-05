import { spawn } from "node:child_process";
import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminUser } from "./lib/seed";
import { validateConfig } from "./lib/auth";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function runMigrations(): Promise<void> {
  return new Promise((resolve) => {
    logger.info("Running database migrations...");

    const child = spawn(
      "pnpm",
      ["--filter", "@workspace/db", "run", "push-force"],
      {
        cwd: process.cwd(),
        stdio: "pipe",
        env: process.env,
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        logger.info("Database migrations applied successfully");
      } else {
        logger.error({ code, stderr: stderr.trim() }, "Database migration failed — server will continue");
      }
      resolve();
    });

    child.on("error", (err) => {
      logger.error({ err }, "Failed to spawn migration process — server will continue");
      resolve();
    });
  });
}

const server = app.listen(port, () => {
  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");

  // Validate config after binding — server stays up even if misconfigured,
  // errors appear in Railway logs rather than crashing before healthcheck
  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL is not set. Go to Railway → your service → Variables and add DATABASE_URL from your PostgreSQL service.");
  }

  validateConfig();

  runMigrations()
    .then(() => seedAdminUser())
    .catch((err) => logger.error({ err }, "Post-startup tasks failed"));
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server...");

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
      process.exit(1);
    }

    try {
      await pool.end();
      logger.info("Database pool closed");
    } catch (dbErr) {
      logger.error({ err: dbErr }, "Error closing database pool");
    }

    logger.info("Server shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
  process.exit(1);
});

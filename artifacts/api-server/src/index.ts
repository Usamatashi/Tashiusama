import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminUser } from "./lib/seed";
import { validateConfig } from "./lib/auth";
import "./lib/firebase";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  logger.warn(
    "FIREBASE_SERVICE_ACCOUNT is not set. " +
    "Go to Firebase Console → Project Settings → Service Accounts → Generate new private key, " +
    "then set FIREBASE_SERVICE_ACCOUNT to the JSON string in your environment variables.",
  );
}

validateConfig();

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");
  seedAdminUser().catch((err) => logger.error({ err }, "Post-startup tasks failed"));
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server...");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
      process.exit(1);
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

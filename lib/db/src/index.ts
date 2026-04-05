import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ?? "";

if (!connectionString) {
  console.error(
    "[db] WARNING: DATABASE_URL is not set — database operations will fail. " +
    "Set DATABASE_URL in your Railway Variables and link it to your PostgreSQL service.",
  );
}

const isProduction = process.env.NODE_ENV === "production";

const sslRequired =
  isProduction ||
  connectionString.includes("sslmode=require") ||
  connectionString.includes("sslmode=verify");

export const pool = new Pool({
  connectionString: connectionString || "postgresql://localhost/placeholder",
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";

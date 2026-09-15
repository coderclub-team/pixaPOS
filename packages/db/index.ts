/**
 * @pixa/db client — Neon Postgres via serverless driver.
 * DATABASE_URL is required only where the server runs (sync API, scripts).
 * Importing this module never connects at import time.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

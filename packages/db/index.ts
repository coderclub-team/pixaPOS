/**
 * @pixa/db client — standard Postgres via node-postgres pool.
 * Works against Neon or Layerbase (both speak the Postgres wire protocol).
 * DATABASE_URL is required only where the server runs (sync API, scripts).
 * Importing this module never connects at import time.
 *
 * Pooling: keep the client pool small — Layerbase/Neon pooled connection
 * strings multiplex server-side, so a big client pool only wastes slots.
 * The pooler also caps new connections per source IP, which matters for
 * serverless fleets sharing NAT egress addresses.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";
import * as saasSchema from "./saas-schema";

export * from "./schema";
export * from "./auth-schema";
export * from "./saas-schema";
export * from "./plans";

const fullSchema = { ...schema, ...authSchema, ...saasSchema };

function poolMax(): number {
  const raw = Number(process.env.DB_POOL_MAX ?? "");
  if (Number.isInteger(raw) && raw >= 1 && raw <= 50) return raw;
  return 5;
}

let cached: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;
let pool: Pool | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) {
    // `?sslmode=require` in the URL is honored by node-postgres.
    pool = new Pool({ connectionString: url, max: poolMax() });
    pool.on("error", (err) => {
      // Idle-client errors must not crash the server; queries will surface
      // their own errors to callers.
      console.error("[db] idle pool client error", err instanceof Error ? err.message : err);
    });
    cached = drizzle(pool, { schema: fullSchema });
  }
  return cached;
}

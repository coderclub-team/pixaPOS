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

/**
 * Shared pool factory. Normalizes `sslmode=require` to `verify-full`:
 * same TLS, plus hostname verification, and silences pg-connection-string's
 * libpq-compat warning. Both Neon and Layerbase serve valid public certs.
 */
export function createDbPool(url: string, max = poolMax()): Pool {
  const normalized = url.replace(/([?&])sslmode=require(&|$)/, "$1sslmode=verify-full$2");
  const pool = new Pool({ connectionString: normalized, max });
  pool.on("error", (err) => {
    // Idle-client errors must not crash the server; queries will surface
    // their own errors to callers.
    console.error("[db] idle pool client error", err instanceof Error ? err.message : err);
  });
  return pool;
}

let cached: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;
let pool: Pool | null = null;
let loggedTarget = false;

/** Host + database only — never logs credentials. */
function describeTarget(url: string): string {
  const m = url.match(/^postgresql:\/\/.*@([^/]+)\/([^?]+)/);
  if (!m) return "DATABASE_URL=<unparseable>";
  return `host=${m[1]} db=${m[2]}`;
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) {
    if (!loggedTarget) {
      loggedTarget = true;
      console.info(`[db] connecting: ${describeTarget(url)}`);
    }
    // `?sslmode=require` in the URL is honored by node-postgres.
    pool = createDbPool(url);
    cached = drizzle(pool, { schema: fullSchema });
  }
  return cached;
}

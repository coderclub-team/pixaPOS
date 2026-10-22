import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@pixa/db";

export function adminDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const normalized = url.replace(/([?&])sslmode=require(&|$)/, "$1sslmode=verify-full$2");
  const pool = new Pool({ connectionString: normalized, max: 5 });
  return drizzle(pool, { schema });
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

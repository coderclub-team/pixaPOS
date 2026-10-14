import { sql } from "drizzle-orm";
import { db } from "@pixa/db";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/realtime/sequence is server-only (imports @pixa/db). Client code must use ./sequence-local instead.",
  );
}

/**
 * Per-outlet monotonic sequence.
 * Uses a transaction with SELECT MAX(sequence) FOR UPDATE semantics
 * via advisory lock fallback when no row exists yet.
 * Must be called inside a DB transaction for correctness.
 */
export async function nextOutletSequence(
  outletId: string,
  // optional injected db for testing
  database?: ReturnType<typeof db>,
): Promise<number> {
  const databaseInstance = database ?? db();
  // Advisory lock keyed by outletId hash to serialize concurrent inserts
  // without requiring a separate counter table.
  // Use pg_advisory_xact_lock which auto-releases at transaction end.
  const key = hashOutletKey(outletId);
  await databaseInstance.execute(sql`SELECT pg_advisory_xact_lock(${key})`);
  const rows = await databaseInstance.execute(
    sql`SELECT COALESCE(MAX(sequence), 0)::int as max_seq FROM events WHERE outlet_id = ${outletId}`,
  );
  const maxRow = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows?.[0] as
    | Record<string, unknown>
    | undefined;
  // node-postgres returns { rows }; keep the array-shape fallback for safety.
  const rawRows = Array.isArray(rows) ? (rows as unknown as Array<Record<string, unknown>>) : [];
  let maxSeq = 0;
  if (rawRows.length > 0 && rawRows[0] !== undefined) {
    const r = rawRows[0] as Record<string, unknown>;
    maxSeq = Number(r.max_seq ?? r.maxSeq ?? r.max ?? 0);
  } else if (maxRow) {
    maxSeq = Number(maxRow.max_seq ?? maxRow.maxSeq ?? 0);
  }
  // Fallback: query via select if above shape mismatched
  if (maxSeq === 0) {
    try {
      const fallback = await databaseInstance.execute(
        sql`SELECT COALESCE(MAX(sequence),0) as m FROM events WHERE outlet_id=${outletId}`,
      );
      const fr = Array.isArray(fallback)
        ? (fallback as unknown as Array<Record<string, unknown>>)[0]
        : null;
      if (fr) maxSeq = Number((fr as Record<string, unknown>).m ?? 0);
    } catch {
      /* ignore */
    }
  }
  return maxSeq + 1;
}

function hashOutletKey(outletId: string): number {
  let h = 0;
  for (let i = 0; i < outletId.length; i++) h = (Math.imul(31, h) + outletId.charCodeAt(i)) | 0;
  // postgres advisory lock wants bigint; use 32-bit int
  return Math.abs(h) % 2147483647;
}

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { authFailed, resolveRealtimeAuth } from "@/lib/realtime/auth";

export const dynamic = "force-dynamic";

function extractRows<T>(result: unknown): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as unknown as T[];
  const obj = result as { rows?: unknown[] };
  if (Array.isArray(obj.rows)) return obj.rows as unknown as T[];
  return [];
}

/**
 * GET /api/events/debug?outletId= — recent events without customer PII.
 * Same auth as /api/events. Strips customer_name/phone/address from payloads.
 */
export async function GET(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes))
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const { organizationId, outletId } = authRes.ctx;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 100);
  try {
    const database = db();
    const result = await database.execute(
      sql`SELECT id, event_type, entity_type, entity_id, organization_id, outlet_id, sequence, source_type, source_device_id, created_at::text as created_at FROM events WHERE outlet_id = ${outletId} AND organization_id = ${organizationId} ORDER BY sequence DESC LIMIT ${limit}`,
    );
    const rows = extractRows<Record<string, unknown>>(result);
    const total = await database
      .execute(sql`SELECT COUNT(*)::text as c FROM events WHERE outlet_id = ${outletId}`)
      .then((r) => extractRows<{ c: string }>(r)[0]?.c ?? "0")
      .catch(() => "0");
    const maxSeq = await database
      .execute(
        sql`SELECT COALESCE(MAX(sequence),0)::text as m FROM events WHERE outlet_id = ${outletId}`,
      )
      .then((r) => extractRows<{ m: string }>(r)[0]?.m ?? "0")
      .catch(() => "0");
    return NextResponse.json(
      {
        events: rows,
        metrics: {
          events_created: Number(total) || 0,
          max_sequence: Number(maxSeq) || 0,
          outletId,
          organizationId,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "debug query failed" }, { status: 500 });
  }
}

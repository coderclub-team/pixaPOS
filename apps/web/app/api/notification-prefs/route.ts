import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { resolveRealtimeAuth } from "@/lib/realtime/auth";

export const dynamic = "force-dynamic";

function extractRows<T>(result: unknown): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as unknown as T[];
  const obj = result as { rows?: unknown[] };
  if (Array.isArray(obj.rows)) return obj.rows as unknown as T[];
  return [];
}

export async function GET(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (!authRes.ok) return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const { outletId, deviceId } = authRes.ctx;
  try {
    const database = db();
    const result = await database.execute(
      sql`SELECT prefs FROM notification_preferences WHERE outlet_id = ${outletId} AND ((device_id = ${deviceId ?? null}) OR (device_id IS NULL)) ORDER BY device_id NULLS LAST LIMIT 2`,
    );
    const rows = extractRows<{ prefs: unknown }>(result);
    const prefs = rows[0]?.prefs ?? null;
    return NextResponse.json({ prefs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ prefs: null }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (!authRes.ok) return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const { organizationId, outletId, deviceId, userId } = authRes.ctx;
  let body: { prefs?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.prefs || typeof body.prefs !== "object") {
    return NextResponse.json({ error: "prefs object required" }, { status: 400 });
  }
  try {
    const database = db();
    const id = ulid();
    await database.execute(
      sql`INSERT INTO notification_preferences (id, organization_id, outlet_id, device_id, user_id, prefs, created_at, updated_at)
          VALUES (${id}, ${organizationId}, ${outletId}, ${deviceId ?? null}, ${userId}, ${JSON.stringify(body.prefs)}::jsonb, now(), now())
          ON CONFLICT (outlet_id, device_id, user_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()`,
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to save prefs" }, { status: 500 });
  }
}

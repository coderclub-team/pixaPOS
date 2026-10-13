import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { resolveRealtimeAuth, authFailed } from "@/lib/realtime/auth";
import { ulid } from "@pixa/contracts";

export const dynamic = "force-dynamic";

function slugCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toUpperCase();
}

export async function GET(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes))
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const { outletId } = authRes.ctx;
  try {
    const database = db();
    const result = await database.execute(
      sql`SELECT id, organization_id, outlet_id, name, code, display_order, is_active, created_at::text as created_at, updated_at::text as updated_at FROM outlet_kitchen_stations WHERE outlet_id = ${outletId} ORDER BY display_order ASC, name ASC`,
    );
    const rows = Array.isArray(result) ? (result as unknown as Record<string, unknown>[]) : [];
    return NextResponse.json({ stations: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ stations: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes))
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const { organizationId, outletId } = authRes.ctx;
  let body: { name?: string; code?: string; display_order?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name || name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });
  const code = (body.code ?? slugCode(name)).trim().toUpperCase().slice(0, 32);
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const displayOrder = Number.isFinite(body.display_order) ? Number(body.display_order) : 0;
  const id = ulid();
  try {
    const database = db();
    await database.execute(
      sql`INSERT INTO outlet_kitchen_stations (id, organization_id, outlet_id, name, code, display_order, is_active, created_at, updated_at)
          VALUES (${id}, ${organizationId}, ${outletId}, ${name}, ${code}, ${displayOrder}, true, now(), now())`,
    );
    return NextResponse.json(
      { ok: true, id, name, code, display_order: displayOrder },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("stations_outlet_code_uidx")
    ) {
      return NextResponse.json(
        { error: "station code already exists for outlet" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "failed to create station" }, { status: 500 });
  }
}

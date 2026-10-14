import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { authFailed, resolveRealtimeAuth } from "@/lib/realtime/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    deviceId?: string;
    device_id?: string;
    terminalType?: string;
    deviceType?: string;
    name?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const deviceId = (body.deviceId ?? body.device_id ?? "").trim().slice(0, 64);
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  const deviceType = (body.terminalType ?? body.deviceType ?? "POS").trim().slice(0, 32);
  const name = (body.name ?? deviceId).trim().slice(0, 128);

  // Resolve auth from query outletId or body outletId
  const url = new URL(req.url);
  let outletId = url.searchParams.get("outletId")?.trim() ?? "";
  // allow outletId in body as fallback
  if (!outletId) {
    const b = body as unknown as Record<string, unknown>;
    outletId = (b.outletId as string | undefined)?.trim() ?? "";
  }
  // Build a synthetic request with outletId for auth helper if needed
  let authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes) && outletId) {
    // retry with explicit outletId in URL
    const syn = new Request(
      `${url.origin}${url.pathname}?outletId=${encodeURIComponent(outletId)}`,
      {
        headers: req.headers,
      },
    );
    authRes = await resolveRealtimeAuth(syn);
  }
  if (authFailed(authRes)) {
    // Fallback: try raw session to give better error
    try {
      const hdrs = await headers();
      const session = await auth.api.getSession({ headers: hdrs as unknown as Headers });
      if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const failed = authRes as { ok: false; status: number; error: string };
    return NextResponse.json({ error: failed.error }, { status: failed.status });
  }
  const { organizationId, outletId: authedOutletId } = authRes.ctx;
  // Use authed outlet from session path (server-truth)
  const finalOutletId = authedOutletId || outletId;
  if (!finalOutletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  // Upsert device row (best-effort; ignore if table not migrated)
  try {
    const database = db();
    await database.execute(
      sql`INSERT INTO devices (device_id, outlet_id, organization_id, device_type, name, last_seen_at, status, created_at, updated_at)
          VALUES (${deviceId}, ${finalOutletId}, ${organizationId}, ${deviceType}, ${name}, now(), 'active', now(), now())
          ON CONFLICT (device_id) DO UPDATE SET outlet_id = EXCLUDED.outlet_id, organization_id = EXCLUDED.organization_id, device_type = EXCLUDED.device_type, name = EXCLUDED.name, last_seen_at = now(), updated_at = now()`,
    );
  } catch {
    // table not yet migrated — still return success (client can operate in poll mode)
  }

  return NextResponse.json(
    { ok: true, deviceId, organizationId, outletId: finalOutletId, deviceType },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes)) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }
  return NextResponse.json({ ok: true, ...authRes.ctx });
}

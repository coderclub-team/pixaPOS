import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { authFailed, resolveRealtimeAuth } from "@/lib/realtime/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe — store a Web Push subscription on the device row.
 * Secondary mechanism only: DB/SSE remain authoritative. Sending is wired
 * later (VAPID sender); registration alone enables future background alerts.
 */
export async function POST(req: Request) {
  /* OFFLINE-FIRST-DISABLED: push subscription intake forced off (no sender
   * wired; registration alone served no purpose). Restore the body below to
   * re-enable. The GET below stays: it reports the VAPID key (null when
   * unconfigured) so clients keep disabling push gracefully.
   */
  void req;
  return NextResponse.json({ error: "push disabled" }, { status: 501 });
  /*
  const url = new URL(req.url);
  let body: {
    subscription?: { endpoint?: string; keys?: Record<string, string> };
    deviceId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint || typeof sub.endpoint !== "string") {
    return NextResponse.json({ error: "subscription.endpoint required" }, { status: 400 });
  }
  const authReq = new Request(
    `${url.origin}${url.pathname}?outletId=${encodeURIComponent(url.searchParams.get("outletId") ?? "")}&deviceId=${encodeURIComponent(body.deviceId ?? url.searchParams.get("deviceId") ?? "")}`,
    { headers: req.headers },
  );
  const authRes = await resolveRealtimeAuth(authReq);
  if (authFailed(authRes))
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  const deviceId = authRes.ctx.deviceId;
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  try {
    const database = db();
    await database.execute(
      sql`UPDATE devices SET push_token = ${JSON.stringify(sub)}, last_seen_at = now(), updated_at = now() WHERE device_id = ${deviceId}`,
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to store subscription" }, { status: 500 });
  }
  */
}

export async function GET() {
  // Expose VAPID public key for clients (empty when unconfigured → push disabled client-side).
  return NextResponse.json(
    { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

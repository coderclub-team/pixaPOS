import { NextResponse } from "next/server";
import { baHas, baOrgId, baSession } from "@/lib/auth-session";
import { signDeviceToken } from "@/lib/device-token";
import { checkKioskPin, getOutletById } from "@/features/outlet/api/service";

const COOKIE_ATTRS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

/**
 * POST /api/device/pair — bind this browser to the outlet while online.
 * - Staff: requires a live Better Auth session; embeds user/org/role.
 * - Kiosk: { kiosk: true, outlet_id, pin } — verifies (or first-sets, for
 *   outlet managers) the outlet PIN; embeds outlet scope, no user.
 * Sets the httpOnly pixa_device cookie the middleware trusts offline.
 */
export async function POST(req: Request) {
  let body: {
    device_id?: string;
    device_name?: string;
    outlet_id?: string;
    kiosk?: boolean;
    pin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const deviceId = (body.device_id ?? "").trim().slice(0, 64) || "unknown-device";

  if (body.kiosk) {
    const outletId = (body.outlet_id ?? "").trim();
    if (!outletId) return NextResponse.json({ error: "outlet_id required" }, { status: 400 });
    const outlet = await getOutletById(outletId).catch(() => null);
    if (!outlet) return NextResponse.json({ error: "outlet not found" }, { status: 404 });
    // First-time PIN setup requires an outlet manager session; afterwards
    // the PIN alone pairs.
    const needsSetup = !outlet.kiosk_pin_hash;
    let allowSet = false;
    if (needsSetup) {
      try {
        allowSet = await baHas("org:outlet:manage");
      } catch {
        allowSet = false;
      }
      if (!allowSet) {
        return NextResponse.json(
          { error: "manager sign-in required for first setup" },
          { status: 403 },
        );
      }
    }
    const ok = await checkKioskPin(outletId, body.pin ?? "", { allowSet });
    if (!ok) return NextResponse.json({ error: "invalid pin" }, { status: 403 });
    const token = await signDeviceToken({
      device_id: deviceId,
      kiosk: true,
      outlet_id: outletId,
    });
    const res = NextResponse.json({ ok: true, kiosk: true, outlet_id: outletId });
    res.headers.append("Set-Cookie", `pixa_device=${encodeURIComponent(token)}; ${COOKIE_ATTRS}`);
    return res;
  }

  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "sign-in required (online) to pair" }, { status: 401 });
  }
  if (!session?.user) {
    return NextResponse.json({ error: "sign-in required (online) to pair" }, { status: 401 });
  }
  let orgId: string | null = null;
  let role: string | null = null;
  try {
    orgId = await baOrgId();
    if (orgId) {
      const { baMemberRole } = await import("@/lib/auth-session");
      role = await baMemberRole(orgId, session.user.id);
    }
  } catch {
    // Role snapshot is best-effort; identity without role still pairs.
  }
  const token = await signDeviceToken({
    device_id: deviceId,
    user_id: session.user.id,
    org_id: orgId,
    role,
  });
  const res = NextResponse.json({ ok: true, user_id: session.user.id });
  res.headers.append("Set-Cookie", `pixa_device=${encodeURIComponent(token)}; ${COOKIE_ATTRS}`);
  return res;
}

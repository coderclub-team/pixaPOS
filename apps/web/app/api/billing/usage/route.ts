import { NextResponse } from "next/server";
import { baOrgId, requireBaUser } from "@/lib/auth-session";
import { getLimits, getPlan } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";

export const dynamic = "force-dynamic";

/**
 * Organization usage + effective limits for the signed-in restaurant user's
 * active organization. Never trusts a client-provided organizationId.
 */
export async function GET() {
  try {
    await requireBaUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const organizationId = await baOrgId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "no active organization" }, { status: 400 });
  }
  try {
    const [plan, limits, snapshot] = await Promise.all([
      getPlan(organizationId),
      getLimits(organizationId),
      getUsageSnapshot(organizationId),
    ]);
    return NextResponse.json({
      ok: true,
      organizationId,
      plan: {
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        monthlyPaise: plan.monthlyPaise,
        flags: plan.flags,
      },
      limits,
      usage: snapshot.usage,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      infraSyncedAt: snapshot.infraSyncedAt,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "usage unavailable" }, { status: 503 });
  }
}

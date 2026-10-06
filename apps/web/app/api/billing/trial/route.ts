import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, baMember, orgProfiles } from "@pixa/db";
import { baSession } from "@/lib/auth-session";

/**
 * GET /api/billing/trial?organization_id= — server trial truth. The caller
 * must hold a live session with membership in the org; the row is written by
 * /api/onboarding (self-serve) or the admin approve path.
 */
export async function GET(req: Request) {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "sign-in required" }, { status: 401 });
  }
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "sign-in required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const organizationId = (searchParams.get("organization_id") ?? "").trim();
  if (!organizationId)
    return NextResponse.json({ error: "organization_id required" }, { status: 400 });

  const database = db();
  const membership = await database
    .select({ id: baMember.id })
    .from(baMember)
    .where(and(eq(baMember.organizationId, organizationId), eq(baMember.userId, user.id)))
    .limit(1);
  if (membership.length === 0) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await database
    .select({
      lifecycle: orgProfiles.lifecycle,
      plan: orgProfiles.plan,
      trialEndsAt: orgProfiles.trialEndsAt,
      isBlocked: orgProfiles.isBlocked,
    })
    .from(orgProfiles)
    .where(eq(orgProfiles.organizationId, organizationId))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ trial: null });
  return NextResponse.json({ trial: rows[0] });
}

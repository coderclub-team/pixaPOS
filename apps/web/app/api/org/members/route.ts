import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, baMember, baUser, outletMembers } from "@pixa/db";
import { baHas, baOrgId, baSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/org/members — org members with role + assigned outlet ids.
 * Gated by org:users:manage. Powers the per-outlet team assignment UI.
 */
export async function GET() {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await baHas("org:users:manage").catch(() => false))) {
    return NextResponse.json({ error: "forbidden: users manage required" }, { status: 403 });
  }
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId)
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  try {
    const database = db();
    const members = await database
      .select({
        userId: baMember.userId,
        role: baMember.role,
        name: baUser.name,
        email: baUser.email,
      })
      .from(baMember)
      .leftJoin(baUser, eq(baUser.id, baMember.userId))
      .where(eq(baMember.organizationId, organizationId));
    const assignments = await database
      .select({ userId: outletMembers.userId, outletId: outletMembers.outletId })
      .from(outletMembers)
      .where(
        and(eq(outletMembers.organizationId, organizationId), eq(outletMembers.isActive, true)),
      );
    const byUser = new Map<string, string[]>();
    for (const a of assignments) {
      const list = byUser.get(a.userId) ?? [];
      list.push(a.outletId);
      byUser.set(a.userId, list);
    }
    return NextResponse.json(
      {
        members: members.map((m) => ({
          user_id: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          outlet_ids: byUser.get(m.userId) ?? [],
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list members" }, { status: 500 });
  }
}

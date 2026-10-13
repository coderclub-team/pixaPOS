import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, outletMembers, baMember } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { baHas, baOrgId, baSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

async function gate(): Promise<{ organizationId: string } | NextResponse> {
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
  return { organizationId };
}

/** GET — members assigned to an outlet (with org role). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g instanceof NextResponse) return g;
  const { id: outletId } = await ctx.params;
  try {
    const database = db();
    const rows = await database
      .select({
        userId: outletMembers.userId,
        isActive: outletMembers.isActive,
        role: baMember.role,
      })
      .from(outletMembers)
      .leftJoin(
        baMember,
        and(
          eq(baMember.userId, outletMembers.userId),
          eq(baMember.organizationId, outletMembers.organizationId),
        ),
      )
      .where(
        and(
          eq(outletMembers.organizationId, g.organizationId),
          eq(outletMembers.outletId, outletId),
        ),
      );
    return NextResponse.json(
      { members: rows.filter((r) => r.isActive) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list members" }, { status: 500 });
  }
}

/** POST { user_id } — assign an org member to the outlet. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g instanceof NextResponse) return g;
  const { id: outletId } = await ctx.params;
  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const userId = (body.user_id ?? "").trim();
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  try {
    const database = db();
    // Must be an org member.
    const mem = await database
      .select({ id: baMember.id })
      .from(baMember)
      .where(and(eq(baMember.organizationId, g.organizationId), eq(baMember.userId, userId)))
      .limit(1);
    if (mem.length === 0)
      return NextResponse.json({ error: "not an organization member" }, { status: 404 });
    // Outlet must belong to the org.
    const out = await database.execute(
      sql`SELECT id FROM outlets WHERE id = ${outletId} AND organization_id = ${g.organizationId} LIMIT 1` as never,
    );
    if (!Array.isArray(out) || (out as unknown[]).length === 0) {
      return NextResponse.json({ error: "outlet not found" }, { status: 404 });
    }
    await database
      .insert(outletMembers)
      .values({
        id: ulid(),
        organizationId: g.organizationId,
        outletId,
        userId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [outletMembers.outletId, outletMembers.userId],
        set: { isActive: true, updatedAt: new Date() },
      });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to assign member" }, { status: 500 });
  }
}

/** DELETE { user_id } — deactivate assignment (never hard-delete). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g instanceof NextResponse) return g;
  const { id: outletId } = await ctx.params;
  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const userId = (body.user_id ?? "").trim();
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  try {
    await db()
      .update(outletMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(outletMembers.organizationId, g.organizationId),
          eq(outletMembers.outletId, outletId),
          eq(outletMembers.userId, userId),
        ),
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to remove member" }, { status: 500 });
  }
}

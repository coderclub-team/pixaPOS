import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, outletMembers, outlets } from "@pixa/db";
import { baMemberRole, baOrgId, baSession } from "@/lib/auth-session";
import { allowedSurfaces } from "@/lib/surfaces";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/outlets — outlets the caller may access + their surfaces.
 * Org admins/managers bypass assignments (all outlets). Others are scoped
 * to active outlet_members rows.
 */
export async function GET(req: Request) {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId)
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  const role = await baMemberRole(organizationId, session.user.id).catch(() => null);
  const surfaces = allowedSurfaces(role);
  const bypass =
    role === "owner" ||
    role === "org:owner" ||
    role === "admin" ||
    role === "org:admin" ||
    role === "manager" ||
    role === "org:manager";

  try {
    const database = db();
    const shape = {
      id: outlets.id,
      name: outlets.name,
      code: outlets.code,
      is_active: outlets.isActive,
    };
    if (bypass) {
      const rows = await database
        .select(shape)
        .from(outlets)
        .where(eq(outlets.organizationId, organizationId))
        .orderBy(outlets.name);
      return NextResponse.json(
        { outlets: rows, surfaces, role },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const rows = await database
      .select({ outletId: outletMembers.outletId })
      .from(outletMembers)
      .where(
        and(
          eq(outletMembers.organizationId, organizationId),
          eq(outletMembers.userId, session.user.id),
          eq(outletMembers.isActive, true),
        ),
      );
    const ids = rows.map((r) => r.outletId);
    if (ids.length === 0) {
      return NextResponse.json(
        { outlets: [], surfaces, role },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const outletRows = await database
      .select(shape)
      .from(outlets)
      .where(and(eq(outlets.organizationId, organizationId), inArray(outlets.id, ids)))
      .orderBy(outlets.name);
    return NextResponse.json(
      { outlets: outletRows, surfaces, role },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list outlets" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, occupancyGroups } from "@pixa/db";
import { authz, toHttpError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/occupancy-groups/:id — single active-or-historical group. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const rows = await db()
      .select()
      .from(occupancyGroups)
      .where(
        and(eq(occupancyGroups.id, id), eq(occupancyGroups.organizationId, a.auth.organizationId)),
      )
      .limit(1);
    const group = (rows[0] ?? null) as unknown as Record<string, unknown> | null;
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ group }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to load occupancy group");
  }
}

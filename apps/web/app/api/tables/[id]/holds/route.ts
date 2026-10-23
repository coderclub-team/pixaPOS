import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, reservationHolds } from "@pixa/db";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { createHold } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** GET /api/tables/:id/holds — active holds for a table. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const rows = await db()
      .select()
      .from(reservationHolds)
      .where(
        and(
          eq(reservationHolds.organizationId, a.auth.organizationId),
          eq(reservationHolds.tableId, id),
          eq(reservationHolds.status, "HELD"),
        ),
      );
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to list holds");
  }
}

/** POST /api/tables/:id/holds — create a reservation hold. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesOperate);
  if ("error" in a) return a.error;
  let body: {
    holder_name?: string;
    holder_phone?: string;
    party_size?: number;
    hold_from?: string;
    hold_until?: string;
    outlet_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const outletId = await assertOrgOutlet(a.auth.organizationId, body.outlet_id ?? null, {
      required: true,
    });
    const hold = await createHold({
      table_id: id,
      holder_name: body.holder_name ?? "",
      holder_phone: body.holder_phone,
      party_size: Number(body.party_size),
      hold_from: String(body.hold_from ?? ""),
      hold_until: String(body.hold_until ?? ""),
      ctx: { organizationId: a.auth.organizationId, outletId, actorId: a.auth.userId },
    });
    return NextResponse.json({ ok: true, hold }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create hold");
  }
}

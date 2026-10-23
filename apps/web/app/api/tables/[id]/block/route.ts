import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { blockTable, unblockTable } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** POST /api/tables/:id/block — { reason } blocks; { release: true } unblocks. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesManage);
  if ("error" in a) return a.error;
  let body: {
    reason?: string;
    release?: boolean;
    by?: string;
    until_at?: string;
    outlet_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const outletId = await assertOrgOutlet(a.auth.organizationId, body.outlet_id ?? null);
    const base = { organizationId: a.auth.organizationId, outletId, actorId: a.auth.userId };
    if (body.release === true) {
      await unblockTable({ table_id: id, by: body.by, ctx: base });
      return NextResponse.json({ ok: true, released: true });
    }
    const block = await blockTable({
      table_id: id,
      reason: body.reason ?? "",
      by: body.by,
      until_at: body.until_at,
      ctx: base,
    });
    return NextResponse.json({ ok: true, block }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to update table block");
  }
}

/** DELETE /api/tables/:id/block — unblock (idempotent). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesManage);
  if ("error" in a) return a.error;
  try {
    await unblockTable({
      table_id: id,
      ctx: { organizationId: a.auth.organizationId, actorId: a.auth.userId },
    });
    return NextResponse.json({ ok: true, released: true });
  } catch (e) {
    return toHttpError(e, "failed to unblock table");
  }
}

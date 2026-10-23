import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { removeDraftItem, updateDraftItemQty } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** PATCH /api/orders/:id/items/:lineId { qty } — draft-line qty edit. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { qty?: number };
  try {
    body = (await req.json()) as { qty?: number };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const order = await updateDraftItemQty(a.auth.organizationId, id, lineId, Number(body.qty), {
      actorId: a.auth.userId,
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to update line");
  }
}

/** DELETE /api/orders/:id/items/:lineId — remove a draft line. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  try {
    const order = await removeDraftItem(a.auth.organizationId, id, lineId, {
      actorId: a.auth.userId,
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to remove line");
  }
}

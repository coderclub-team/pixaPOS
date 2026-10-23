import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { deleteOrder, getOrderById } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** GET /api/orders/:id — single order with derived fields. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  try {
    const order = await getOrderById(a.auth.organizationId, id);
    if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e) {
    return toHttpError(e, "failed to load order");
  }
}

/** DELETE /api/orders/:id?by= — draft-only delete. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  const by = new URL(req.url).searchParams.get("by") ?? a.auth.userId;
  try {
    await deleteOrder(a.auth.organizationId, id, { actorId: by ?? "staff" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toHttpError(e, "failed to delete order");
  }
}

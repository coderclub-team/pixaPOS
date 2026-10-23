import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { serveOpenTickets } from "@/features/kitchen/api/server";
import {
  assignRider,
  dispatchOrder,
  markDelivered,
  setDeliveryAddress,
} from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/dispatch { action, ... } — dispatch-console ops.
 * action: assign-rider | dispatch | deliver | address.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const by = (body.by as string | undefined) ?? a.auth.userId ?? "staff";
    const action = String(body.action ?? "");
    if (action === "assign-rider") {
      const order = await assignRider(a.auth.organizationId, id, {
        rider_name: String(body.rider_name ?? ""),
        by,
      });
      return NextResponse.json({ ok: true, order });
    }
    if (action === "dispatch") {
      await serveOpenTickets(a.auth.organizationId, id, { by });
      const order = await dispatchOrder(a.auth.organizationId, id, { by });
      return NextResponse.json({ ok: true, order });
    }
    if (action === "deliver") {
      const order = await markDelivered(a.auth.organizationId, id, { by });
      return NextResponse.json({ ok: true, order });
    }
    if (action === "address") {
      const order = await setDeliveryAddress(a.auth.organizationId, id, {
        delivery_address: String(body.delivery_address ?? ""),
        by,
      });
      return NextResponse.json({ ok: true, order });
    }
    return NextResponse.json({ error: "unknown dispatch action" }, { status: 400 });
  } catch (e) {
    return toHttpError(e, "dispatch action failed");
  }
}

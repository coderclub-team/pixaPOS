import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { cancelOrder } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** POST /api/orders/:id/cancel { reason, by? } — audited cancel with guards. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { reason?: string; by?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const order = await cancelOrder(
      a.auth.organizationId,
      id,
      { reason: String(body.reason ?? ""), by: body.by ?? a.auth.userId ?? "staff" },
      {},
    );
    // TODO(v2): post wastage for kitchen-consumed lines once the server
    // waste ledger exists (local recorded via inventory/waste).
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to cancel order");
  }
}

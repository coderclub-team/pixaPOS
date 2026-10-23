import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { getOrderWithBilling } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** GET /api/orders/:id/billing — order + paid/balance via the payments ledger. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  try {
    const billing = await getOrderWithBilling(a.auth.organizationId, id);
    if (!billing) return NextResponse.json({ error: "order not found" }, { status: 404 });
    return NextResponse.json(billing);
  } catch (e) {
    return toHttpError(e, "failed to load billing");
  }
}

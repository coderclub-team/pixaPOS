import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { getKOTsByOrder } from "@/features/kitchen/api/server";

export const dynamic = "force-dynamic";

/** GET /api/kots/by-order/:orderId — tickets for one order, oldest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  try {
    const tickets = await getKOTsByOrder(a.auth.organizationId, orderId);
    return NextResponse.json({ tickets });
  } catch (e) {
    return toHttpError(e, "failed to load order KOTs");
  }
}

import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { confirmOrder } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** POST /api/orders/:id/confirm { by? } — legacy no-op for CONFIRMED orders. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { by?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body allowed */
  }
  try {
    const order = await confirmOrder(a.auth.organizationId, id, {
      actorId: body.by ?? a.auth.userId ?? "staff",
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to confirm order");
  }
}

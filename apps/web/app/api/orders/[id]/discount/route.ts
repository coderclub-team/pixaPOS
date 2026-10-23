import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { setDiscount } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** PUT /api/orders/:id/discount { percent?, amount_paise?, reason, by? }. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { percent?: number; amount_paise?: number; reason?: string; by?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const order = await setDiscount(a.auth.organizationId, id, {
      percent: body.percent,
      amount_paise: body.amount_paise,
      reason: String(body.reason ?? ""),
      by: body.by ?? a.auth.userId ?? "staff",
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to set discount");
  }
}

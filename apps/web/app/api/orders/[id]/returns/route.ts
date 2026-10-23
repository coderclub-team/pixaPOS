import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { returnKOTLine } from "@/features/kitchen/api/server";
import { applyReturnRefund, getOrderById } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/returns { lines: [{order_line_id, qty}], total_paise,
 * reason, by? } — item-wise post-sale return. KOT lines are marked returned
 * first (kitchen), then billing + largest-first refunds (orders).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: {
    lines?: { order_line_id?: string; kot_line_id?: string; qty?: number }[];
    total_paise?: number;
    reason?: string;
    by?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const by = body.by ?? a.auth.userId ?? "staff";
    const reason = String(body.reason ?? "");
    const order = await getOrderById(a.auth.organizationId, id);
    if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
    // Mark KOT lines returned first (kitchen truth).
    for (const l of body.lines ?? []) {
      const target = order.items.find((i) => i.id === String(l.order_line_id));
      if (!target?.kot_id || !target?.kot_line_id) {
        return NextResponse.json(
          {
            error: `"${target?.item_name_snapshot ?? "line"}" never fired — edit or void it instead`,
          },
          { status: 400 },
        );
      }
      await returnKOTLine(a.auth.organizationId, target.kot_id, target.kot_line_id, {
        qty: Number(l.qty),
        amount_paise: (target.unit_price_paise ?? 0) * Number(l.qty),
        reason,
        by,
      });
    }
    const result = await applyReturnRefund(a.auth.organizationId, id, {
      lines: (body.lines ?? []).map((l) => ({
        order_line_id: String(l.order_line_id),
        qty: Number(l.qty),
      })),
      total_paise: Number(body.total_paise),
      reason,
      by,
    });
    const updated = await getOrderById(a.auth.organizationId, id);
    return NextResponse.json({ ok: true, order: updated, ...result });
  } catch (e) {
    return toHttpError(e, "return failed");
  }
}

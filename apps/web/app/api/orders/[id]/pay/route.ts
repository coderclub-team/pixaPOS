import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { collectPayment } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/pay — collect a payment against the balance.
 * Body: { method, amount_paise, tendered_paise?, partition_label?, received_by? }.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: {
    method?: string;
    amount_paise?: number;
    tendered_paise?: number;
    partition_label?: string;
    received_by?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    if (!body.method) return NextResponse.json({ error: "method is required" }, { status: 400 });
    const payment = await collectPayment(a.auth.organizationId, id, {
      method: body.method,
      amount_paise: Number(body.amount_paise),
      tendered_paise: body.tendered_paise !== undefined ? Number(body.tendered_paise) : undefined,
      partition_label: body.partition_label,
      received_by: body.received_by ?? a.auth.userId ?? "staff",
    });
    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to collect payment");
  }
}

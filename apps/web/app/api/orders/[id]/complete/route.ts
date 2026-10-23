import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { serveOpenTickets } from "@/features/kitchen/api/server";
import { completeOrder } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/complete { by?, reason?, force? } — settle → SERVED
 * (auto-serve open KOTs first, mirroring the local deadlock-safe order) then
 * COMPLETED. Zero balance required on both passes.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { by?: string; reason?: string; force?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body allowed */
  }
  try {
    const by = body.by ?? a.auth.userId ?? "staff";
    await serveOpenTickets(a.auth.organizationId, id, { by });
    const order = await completeOrder(a.auth.organizationId, id, {
      by,
      reason: body.reason,
      force: body.force,
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to complete order");
  }
}

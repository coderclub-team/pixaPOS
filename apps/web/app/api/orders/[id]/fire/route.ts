import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { fireKOT } from "@/features/kitchen/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/fire { by?, stationIds? } — fire all unfired draft
 * lines onto a new KOT, mark them, and advance the order. Route composes
 * kitchen (ticket) + orders (marks/advance) so neither domain imports the other.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { by?: string; stationIds?: string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body allowed */
  }
  try {
    const by = body.by ?? a.auth.userId ?? "staff";
    const fired = await fireKOT(a.auth.organizationId, id, {
      by,
      stationIds: body.stationIds,
    });
    return NextResponse.json(
      { ok: true, order: fired.order, ticket: fired.ticket },
      { status: 201 },
    );
  } catch (e) {
    return toHttpError(e, "failed to fire KOT");
  }
}

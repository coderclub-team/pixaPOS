import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { addOrderItem } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/items — add a draft line.
 * Body: { menu_item_id, variant_id?, modifier_ids?, qty?, instructions? }.
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
    if (typeof body.menu_item_id !== "string" || !body.menu_item_id) {
      return NextResponse.json({ error: "menu_item_id is required" }, { status: 400 });
    }
    const order = await addOrderItem(
      a.auth.organizationId,
      id,
      {
        menu_item_id: body.menu_item_id,
        variant_id: (body.variant_id as string | undefined) ?? undefined,
        modifier_ids: (body.modifier_ids as string[] | undefined) ?? undefined,
        qty: typeof body.qty === "number" ? body.qty : undefined,
        instructions: (body.instructions as string | undefined) ?? undefined,
      },
      { actorId: a.auth.userId },
    );
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to add item");
  }
}

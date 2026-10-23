import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { linkCustomer, setCustomerNotes, unlinkCustomer } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/customer { action, ... } — link | unlink | notes.
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
    const action = String(body.action ?? "");
    if (action === "link") {
      if (typeof body.customer_id !== "string" || !body.customer_id) {
        return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
      }
      const order = await linkCustomer(a.auth.organizationId, id, body.customer_id);
      return NextResponse.json({ ok: true, order });
    }
    if (action === "unlink") {
      const order = await unlinkCustomer(a.auth.organizationId, id, {
        reason: (body.reason as string | undefined) ?? undefined,
        by: a.auth.userId ?? "staff",
      });
      return NextResponse.json({ ok: true, order });
    }
    if (action === "notes") {
      const order = await setCustomerNotes(a.auth.organizationId, id, String(body.notes ?? ""));
      return NextResponse.json({ ok: true, order });
    }
    return NextResponse.json({ error: "unknown customer action" }, { status: 400 });
  } catch (e) {
    return toHttpError(e, "customer action failed");
  }
}

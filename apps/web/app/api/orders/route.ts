import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { createOrder, listOrders } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders?outlet_id=&status=&channel=&table_id=&customer_id=&search=
 * org:pos:cashier. Tenant isolation via session org + required outlet.
 */
export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const outletId = await assertOrgOutlet(
      a.auth.organizationId,
      url.searchParams.get("outlet_id"),
    );
    const rows = await listOrders(a.auth.organizationId, {
      outlet_id: outletId,
      status: url.searchParams.get("status") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      table_id: url.searchParams.get("table_id") ?? undefined,
      customer_id: url.searchParams.get("customer_id") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return toHttpError(e, "failed to list orders");
  }
}

/**
 * POST /api/orders — create a draft/confirmed order. Body mirrors
 * CreateOrderInput plus outlet_id.
 */
export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const outletId = await assertOrgOutlet(
      a.auth.organizationId,
      typeof body.outlet_id === "string" ? body.outlet_id : null,
    );
    const order = await createOrder(
      {
        outlet_id: outletId,
        channel: String(body.channel ?? "dine_in"),
        table_id: (body.table_id as string | undefined) ?? undefined,
        occupancy_group_id: (body.occupancy_group_id as string | undefined) ?? undefined,
        customer_id: (body.customer_id as string | undefined) ?? undefined,
        customer_name: (body.customer_name as string | undefined) ?? undefined,
        customer_phone: (body.customer_phone as string | undefined) ?? undefined,
        customer_notes: (body.customer_notes as string | undefined) ?? undefined,
        delivery_address: (body.delivery_address as string | undefined) ?? undefined,
        scheduled_for: (body.scheduled_for as string | undefined) ?? undefined,
        external_ref: (body.external_ref as string | undefined) ?? undefined,
        initial_status: ((body.initial_status as string | undefined) ?? "CONFIRMED") as
          | "DRAFT"
          | "CONFIRMED",
        created_by: (body.created_by as string | undefined) ?? a.auth.userId,
        staff_initiated: body.staff_initiated !== false,
        off_hours_reason: (body.off_hours_reason as string | undefined) ?? undefined,
      },
      { organizationId: a.auth.organizationId, outletId, actorId: a.auth.userId },
    );
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create order");
  }
}

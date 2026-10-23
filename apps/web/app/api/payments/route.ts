import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { listPayments, listRefunds } from "@/features/payments/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments?outlet_id=&order_id=&method=&status=&kind=refund|payment&search=
 * org:pos:cashier. Refunds ledger included via kind=refund.
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
    if (url.searchParams.get("kind") === "refund") {
      const rows = await listRefunds(a.auth.organizationId, {
        outlet_id: outletId,
        order_id: url.searchParams.get("order_id") ?? undefined,
        status: (url.searchParams.get("status") as never) ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
      });
      return NextResponse.json({ rows });
    }
    const rows = await listPayments(a.auth.organizationId, {
      outlet_id: outletId,
      order_id: url.searchParams.get("order_id") ?? undefined,
      method: (url.searchParams.get("method") as never) ?? undefined,
      status: (url.searchParams.get("status") as never) ?? undefined,
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return toHttpError(e, "failed to list payments");
  }
}

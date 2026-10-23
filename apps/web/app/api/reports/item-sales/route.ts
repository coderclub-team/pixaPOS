import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { itemSalesStats } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** GET /api/reports/item-sales?outlet_id=&from=&to=&channel= — served rollup. */
export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.reportsView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const outletId = await assertOrgOutlet(
      a.auth.organizationId,
      url.searchParams.get("outlet_id"),
    );
    const rows = await itemSalesStats(a.auth.organizationId, {
      outlet_id: outletId,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return toHttpError(e, "failed to load item sales");
  }
}

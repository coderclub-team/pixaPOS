import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { getKitchenTickets } from "@/features/kitchen/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/kots?outlet_id=&status= — KDS board feed, oldest first.
 * org:kds:view.
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
    const rows = await getKitchenTickets(a.auth.organizationId, {
      outlet_id: outletId,
      status: (url.searchParams.get("status") as never) ?? undefined,
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return toHttpError(e, "failed to list KOTs");
  }
}

import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { getStockLedger } from "@/features/inventory/api/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.inventoryView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const rawOutlet = url.searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const entries = await getStockLedger(a.auth.organizationId, outletId, {
      material_id: url.searchParams.get("material_id") ?? undefined,
      type: (url.searchParams.get("type") as any) ?? undefined,
    });
    return NextResponse.json({ entries });
  } catch (e) {
    return toHttpError(e, "failed to get stock ledger");
  }
}

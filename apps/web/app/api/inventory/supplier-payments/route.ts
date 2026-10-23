import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { createSupplierPayment, listSupplierPayments } from "@/features/inventory/api/server";
import type { SupplierPaymentPayload } from "@/features/inventory/api/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.inventoryView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const rawOutlet = url.searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const payments = await listSupplierPayments(a.auth.organizationId, outletId, {
      supplier_id: url.searchParams.get("supplier_id") ?? undefined,
    });
    return NextResponse.json({ payments });
  } catch (e) {
    return toHttpError(e, "failed to list supplier payments");
  }
}

export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.purchasesManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const rawOutlet =
      (body.outlet_id as string | undefined) ?? new URL(req.url).searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const payment = await createSupplierPayment(
      a.auth.organizationId,
      outletId,
      body as unknown as SupplierPaymentPayload,
    );
    return NextResponse.json({ payment }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to record supplier payment");
  }
}

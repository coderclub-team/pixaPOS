import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { getPurchaseOrderById, updatePurchaseOrder } from "@/features/inventory/api/server";
import type { PurchaseOrderPayload } from "@/features/inventory/api/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.inventoryView);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    const order = await getPurchaseOrderById(a.auth.organizationId, id);
    if (!order) {
      return NextResponse.json({ error: "purchase order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e) {
    return toHttpError(e, "failed to get purchase order");
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.purchasesManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const order = await updatePurchaseOrder(
      a.auth.organizationId,
      id,
      body as unknown as Partial<PurchaseOrderPayload>,
      a.auth.userId,
    );
    return NextResponse.json({ order });
  } catch (e) {
    return toHttpError(e, "failed to update purchase order");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx);
}

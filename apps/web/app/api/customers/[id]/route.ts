import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { deleteCustomer, getCustomerById, updateCustomer } from "@/features/customers/api/server";
import type { CustomerPayload } from "@/features/customers/api/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    const customer = await getCustomerById(a.auth.organizationId, id);
    if (!customer) {
      return NextResponse.json({ error: "customer not found" }, { status: 404 });
    }
    return NextResponse.json({ customer });
  } catch (e) {
    return toHttpError(e, "failed to get customer");
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const customer = await updateCustomer(
      a.auth.organizationId,
      id,
      body as unknown as Partial<CustomerPayload>,
      a.auth.userId,
    );
    return NextResponse.json({ customer });
  } catch (e) {
    return toHttpError(e, "failed to update customer");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    await deleteCustomer(a.auth.organizationId, id, a.auth.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toHttpError(e, "failed to delete customer");
  }
}

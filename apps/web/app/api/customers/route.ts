import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { createCustomer, listCustomers } from "@/features/customers/api/server";
import type { CustomerPayload } from "@/features/customers/api/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers?outlet_id=&search=&tag=&is_active=
 */
export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const rawOutlet = url.searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) {
      return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });
    }
    const isActiveParam = url.searchParams.get("is_active");
    const customers = await listCustomers(a.auth.organizationId, outletId, {
      search: url.searchParams.get("search") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      is_active: isActiveParam !== null ? isActiveParam === "true" : undefined,
    });
    return NextResponse.json({ customers });
  } catch (e) {
    return toHttpError(e, "failed to list customers");
  }
}

/**
 * POST /api/customers
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
    const rawOutlet =
      (body.outlet_id as string | undefined) ?? new URL(req.url).searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) {
      return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });
    }
    const customer = await createCustomer(
      a.auth.organizationId,
      outletId,
      body as unknown as CustomerPayload,
      a.auth.userId,
    );
    return NextResponse.json({ customer }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create customer");
  }
}

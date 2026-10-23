import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { discardEmptyDrafts } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/discard-empty { outlet_id? } — sweep abandoned empty
 * drafts (workspace reset / mount). 5-minute age guard server-side.
 */
export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { outlet_id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body allowed */
  }
  try {
    const outletId = body.outlet_id
      ? await assertOrgOutlet(a.auth.organizationId, body.outlet_id)
      : undefined;
    const count = await discardEmptyDrafts(a.auth.organizationId, outletId);
    return NextResponse.json({ ok: true, discarded: count });
  } catch (e) {
    return toHttpError(e, "failed to discard empty drafts");
  }
}

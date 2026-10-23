import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import {
  ensureBareTableOrder,
  ensureGroupOrder,
  ensureTableOrder,
} from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/ensure — terminal capture: return the live order or
 * create+attach one. Body: { mode: table|bare|group, table_id?, group_id?,
 * outlet_id, by? }. Serialized server-side per table/group.
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
    const mode = String(body.mode ?? "table");
    const by = (body.by as string | undefined) ?? a.auth.userId ?? "staff";
    const baseCtx = { outletId, actorId: a.auth.userId ?? undefined };
    if (mode === "group") {
      if (typeof body.group_id !== "string" || !body.group_id) {
        return NextResponse.json({ error: "group_id is required" }, { status: 400 });
      }
      const order = await ensureGroupOrder(a.auth.organizationId, body.group_id, {
        ...baseCtx,
        created_by: by,
      });
      return NextResponse.json({ ok: true, order });
    }
    if (typeof body.table_id !== "string" || !body.table_id) {
      return NextResponse.json({ error: "table_id is required" }, { status: 400 });
    }
    const order =
      mode === "bare"
        ? await ensureBareTableOrder(a.auth.organizationId, body.table_id, {
            ...baseCtx,
            created_by: by,
          })
        : await ensureTableOrder(a.auth.organizationId, body.table_id, {
            ...baseCtx,
            created_by: by,
          });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to ensure order");
  }
}

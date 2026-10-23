import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import type { TableStatus } from "@/features/table/api/types";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { markCleaned, setTableStatus } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/tables/:id/status — explicit transitions (org:tables:operate).
 * { to, reason?, by? }. `to: "available"` on a cleaning table marks it
 * cleaned (TABLE_CLEANING_COMPLETED); occupied→available is rejected
 * (release the party first).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesOperate);
  if ("error" in a) return a.error;
  let body: { to?: string; reason?: string; by?: string; outlet_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const outletId = await assertOrgOutlet(a.auth.organizationId, body.outlet_id ?? null);
    const valid: TableStatus[] = [
      "available",
      "occupied",
      "reserved",
      "cleaning",
      "out_of_service",
    ];
    if (!body.to || !valid.includes(body.to as TableStatus)) {
      return NextResponse.json({ error: "invalid status transition target" }, { status: 400 });
    }
    const base = { organizationId: a.auth.organizationId, outletId, actorId: a.auth.userId };
    // available is the mark-cleaned path (TABLE_CLEANING_COMPLETED, cleaning-only);
    // every other target goes through the guarded setTableStatus.
    const row =
      body.to === "available"
        ? await markCleaned({ table_id: id, by: body.by, ctx: base })
        : await setTableStatus({
            table_id: id,
            to: body.to as TableStatus,
            reason: body.reason ?? "",
            by: body.by,
            ctx: base,
          });
    return NextResponse.json({ ok: true, table: row });
  } catch (e) {
    return toHttpError(e, "failed to change table status");
  }
}

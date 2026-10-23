import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { cancelHold, expireHold } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** PATCH /api/holds/:id — { action: "cancel", reason? } or { action: "expire" }. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesOperate);
  if ("error" in a) return a.error;
  let body: { action?: string; reason?: string; by?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    if (body.action === "cancel") {
      await cancelHold({
        hold_id: id,
        by: body.by,
        reason: body.reason ?? "",
        ctx: { organizationId: a.auth.organizationId, actorId: a.auth.userId },
      });
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "expire") {
      await expireHold({ hold_id: id, organizationId: a.auth.organizationId });
      return NextResponse.json({ ok: true, id });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return toHttpError(e, "failed to update hold");
  }
}

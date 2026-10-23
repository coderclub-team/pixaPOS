import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { setTablePose } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** POST /api/tables/:id/pose — move / resize / rotate (single writer, version bump). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    await setTablePose(
      id,
      {
        x_mm: num(body.x_mm),
        y_mm: num(body.y_mm),
        w_mm: num(body.w_mm),
        h_mm: num(body.h_mm),
        rotation_deg: num(body.rotation_deg),
      },
      { organizationId: a.auth.organizationId, actorId: a.auth.userId },
    );
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to move table");
  }
}

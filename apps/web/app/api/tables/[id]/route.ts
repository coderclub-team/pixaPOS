import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { deleteTable, getTableById, updateTable } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** GET /api/tables/:id — single table with derived occupancy. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const row = await getTableById(id, a.auth.organizationId);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ row }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to load table");
  }
}

/** PATCH /api/tables/:id — structural update (org:tables:manage). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const row = await updateTable(id, body as Parameters<typeof updateTable>[1], {
      organizationId: a.auth.organizationId,
      actorId: a.auth.userId,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return toHttpError(e, "failed to update table");
  }
}

/** DELETE /api/tables/:id — soft delete, refuses active occupancy. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesManage);
  if ("error" in a) return a.error;
  try {
    await deleteTable(id, { organizationId: a.auth.organizationId, actorId: a.auth.userId });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to delete table");
  }
}

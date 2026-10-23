import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, floorObjects } from "@pixa/db";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { recordServerEvent } from "@/features/events/api/server";

export const dynamic = "force-dynamic";

async function loadObject(id: string, organizationId: string) {
  const rows = await db()
    .select()
    .from(floorObjects)
    .where(and(eq(floorObjects.id, id), eq(floorObjects.organizationId, organizationId)))
    .limit(1);
  const row = (rows[0] ?? null) as Record<string, unknown> | null;
  if (!row || (row as { deletedAt?: unknown }).deletedAt) return null;
  return row;
}

/** PATCH /api/floor-objects/:id — pose + label updates (org:floors:manage). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.floorsManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const current = await loadObject(id, a.auth.organizationId);
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    const toCamel = (s: string) =>
      s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      "label",
      "x_mm",
      "y_mm",
      "w_mm",
      "h_mm",
      "rotation_deg",
      "z_index",
      "color",
      "shape_variant",
    ]) {
      if (body[key] !== undefined) patch[toCamel(key)] = body[key];
    }
    await db()
      .update(floorObjects)
      .set(patch)
      .where(and(eq(floorObjects.id, id), eq(floorObjects.organizationId, a.auth.organizationId)));
    await recordServerEvent({
      outlet_id: String(current.outletId),
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: String(current.floorId),
      event_type: "FLOOR_UPDATED",
      actor_id: a.auth.userId,
      reason_code: "OBJECT_POSE",
      metadata: { object_id: id, ...body },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to update floor object");
  }
}

/** DELETE /api/floor-objects/:id — soft delete. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.floorsManage);
  if ("error" in a) return a.error;
  try {
    const current = await loadObject(id, a.auth.organizationId);
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    await db()
      .update(floorObjects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(floorObjects.id, id), eq(floorObjects.organizationId, a.auth.organizationId)));
    await recordServerEvent({
      outlet_id: String(current.outletId),
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: String(current.floorId),
      event_type: "FLOOR_UPDATED",
      actor_id: a.auth.userId,
      reason_code: "OBJECT_DELETED",
      metadata: { object_id: id },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to delete floor object");
  }
}

import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, floorObjects, floors, occupancyGroups, tables } from "@pixa/db";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { recordServerEvent } from "@/features/events/api/server";

export const dynamic = "force-dynamic";

async function loadFloor(id: string, organizationId: string) {
  const rows = await db()
    .select()
    .from(floors)
    .where(and(eq(floors.id, id), eq(floors.organizationId, organizationId)))
    .limit(1);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || (row as { deletedAt?: unknown }).deletedAt) return null;
  return row;
}

/** GET /api/floors/:id — single floor. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const row = await loadFloor(id, a.auth.organizationId);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ row }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to load floor");
  }
}

/** PATCH /api/floors/:id — update (org:floors:manage). Guards shrink vs orphaned tables. */
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
    const current = await loadFloor(id, a.auth.organizationId);
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    const toCamel = (s: string) =>
      s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      "name",
      "code",
      "description",
      "level",
      "capacity",
      "sort_order",
      "is_active",
      "is_outdoor",
      "width_mm",
      "height_mm",
      "grid_size_mm",
      "background_color",
      "background_image_url",
    ]) {
      if (body[key] !== undefined) patch[toCamel(key)] = body[key];
    }
    if (typeof patch.code === "string") patch.code = (patch.code as string).toUpperCase();
    // Shrink guard: no tables/objects may fall outside the new bounds.
    const newW = (patch.widthMm as number | undefined) ?? (current.widthMm as number);
    const newH = (patch.heightMm as number | undefined) ?? (current.heightMm as number);
    if (body.width_mm !== undefined || body.height_mm !== undefined) {
      const ts = await db()
        .select({
          number: tables.number,
          xMm: tables.xMm,
          yMm: tables.yMm,
          wMm: tables.wMm,
          hMm: tables.hMm,
        })
        .from(tables)
        .where(
          and(
            eq(tables.organizationId, a.auth.organizationId),
            eq(tables.floorId, id),
            isNull(tables.deletedAt),
          ),
        );
      const objs = await db()
        .select({
          label: floorObjects.label,
          kind: floorObjects.kind,
          xMm: floorObjects.xMm,
          yMm: floorObjects.yMm,
          wMm: floorObjects.wMm,
          hMm: floorObjects.hMm,
        })
        .from(floorObjects)
        .where(
          and(
            eq(floorObjects.organizationId, a.auth.organizationId),
            eq(floorObjects.floorId, id),
            isNull(floorObjects.deletedAt),
          ),
        );
      const orphans = [
        ...ts.filter((t) => t.xMm + t.wMm > newW || t.yMm + t.hMm > newH).map((t) => t.number),
        ...objs
          .filter((o) => o.xMm + o.wMm > newW || o.yMm + o.hMm > newH)
          .map((o) => o.label ?? o.kind),
      ];
      if (orphans.length > 0) {
        return NextResponse.json(
          {
            error: `Floor shrink would orphan ${orphans.length} item(s) (${orphans.join(", ")}). Move them first.`,
          },
          { status: 400 },
        );
      }
    }
    await db()
      .update(floors)
      .set(patch)
      .where(and(eq(floors.id, id), eq(floors.organizationId, a.auth.organizationId)));
    await recordServerEvent({
      outlet_id: String((current as Record<string, unknown>).outletId),
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: id,
      event_type: "FLOOR_UPDATED",
      actor_id: a.auth.userId,
      metadata: { payload: body },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to update floor");
  }
}

/** DELETE /api/floors/:id — soft delete. Refuses when tables or active occupancy remain. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.floorsManage);
  if ("error" in a) return a.error;
  try {
    const current = await loadFloor(id, a.auth.organizationId);
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [tbls, activeGroups] = await Promise.all([
      db()
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.organizationId, a.auth.organizationId),
            eq(tables.floorId, id),
            isNull(tables.deletedAt),
          ),
        ),
      db()
        .select({ id: occupancyGroups.id })
        .from(occupancyGroups)
        .where(
          and(
            eq(occupancyGroups.organizationId, a.auth.organizationId),
            eq(occupancyGroups.floorId, id),
            inArray(occupancyGroups.status, ["SEATED", "ORDERING"]),
          ),
        ),
    ]);
    if (activeGroups.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete floor with ${activeGroups.length} active occupancy group(s). Release them first.`,
        },
        { status: 400 },
      );
    }
    if (tbls.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete floor with ${tbls.length} tables. Move or delete them first.` },
        { status: 400 },
      );
    }
    await db()
      .update(floors)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(floors.id, id), eq(floors.organizationId, a.auth.organizationId)));
    await recordServerEvent({
      outlet_id: String((current as Record<string, unknown>).outletId),
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: id,
      event_type: "FLOOR_DELETED",
      actor_id: a.auth.userId,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return toHttpError(e, "failed to delete floor");
  }
}

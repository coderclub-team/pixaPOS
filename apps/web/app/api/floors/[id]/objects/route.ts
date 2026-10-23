import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, floorObjects, floors } from "@pixa/db";
import { ulid } from "@pixa/contracts";
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
  const row = (rows[0] ?? null) as Record<string, unknown> | null;
  if (!row || (row as { deletedAt?: unknown }).deletedAt) return null;
  return row;
}

/** GET /api/floors/:id/objects — decor objects for the floor editor. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const floor = await loadFloor(id, a.auth.organizationId);
    if (!floor) return NextResponse.json({ error: "not found" }, { status: 404 });
    const rows = await db()
      .select()
      .from(floorObjects)
      .where(
        and(
          eq(floorObjects.organizationId, a.auth.organizationId),
          eq(floorObjects.floorId, id),
          isNull(floorObjects.deletedAt),
        ),
      );
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to list floor objects");
  }
}

/** POST /api/floors/:id/objects — create a decor object (org:floors:manage). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const floor = await loadFloor(id, a.auth.organizationId);
    if (!floor) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (typeof body.kind !== "string" || !body.kind) {
      return NextResponse.json({ error: "kind is required" }, { status: 400 });
    }
    const widthMm = Number(body.width_mm ?? 12000);
    const heightMm = Number(body.height_mm ?? 8000);
    const [row] = await db()
      .insert(floorObjects)
      .values({
        id: ulid(),
        organizationId: a.auth.organizationId,
        outletId: String((floor as Record<string, unknown>).outletId),
        floorId: id,
        kind: String(body.kind),
        shapeVariant: (body.shape_variant as string) ?? null,
        label: (body.label as string) ?? null,
        xMm: Number(body.x_mm ?? Math.round(widthMm / 2 - 1000)),
        yMm: Number(body.y_mm ?? Math.round(heightMm / 2)),
        wMm: Number(body.w_mm ?? 2000),
        hMm: Number(body.h_mm ?? 150),
        rotationDeg: Number(body.rotation_deg ?? 0),
        zIndex: Number(body.z_index ?? 0),
        color: (body.color as string) ?? null,
      })
      .returning({ id: floorObjects.id });
    await recordServerEvent({
      outlet_id: String((floor as Record<string, unknown>).outletId),
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: id,
      event_type: "FLOOR_UPDATED",
      actor_id: a.auth.userId,
      reason_code: "OBJECT_CREATED",
      metadata: { object_id: row.id, kind: body.kind },
    });
    const [created] = await db()
      .select()
      .from(floorObjects)
      .where(
        and(eq(floorObjects.organizationId, a.auth.organizationId), eq(floorObjects.id, row.id)),
      )
      .limit(1);
    return NextResponse.json({ ok: true, id: row.id, row: created ?? null }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create floor object");
  }
}

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, floors } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { recordServerEvent } from "@/features/events/api/server";

export const dynamic = "force-dynamic";

/** GET /api/floors?outlet_id=&search=&is_active= — floor list (org-scoped). */
export async function GET(req: Request) {
  const a = await authz();
  if ("error" in a) return a.error;
  const q = new URL(req.url).searchParams;
  try {
    const outletId = await assertOrgOutlet(a.auth.organizationId, q.get("outlet_id"));
    const conds = [eq(floors.organizationId, a.auth.organizationId), isNull(floors.deletedAt)];
    if (outletId) conds.push(eq(floors.outletId, outletId));
    if (q.get("is_active") === "true") conds.push(eq(floors.isActive, true));
    if (q.get("is_active") === "false") conds.push(eq(floors.isActive, false));
    let rows = await db()
      .select()
      .from(floors)
      .where(and(...conds))
      .orderBy(floors.sortOrder);
    const search = q.get("search")?.toLowerCase();
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) || (r.code ?? "").toLowerCase().includes(search),
      );
    }
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to list floors");
  }
}

/** POST /api/floors — create a floor (org:floors:manage). */
export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.floorsManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();
    if (name.length < 2) return NextResponse.json({ error: "name too short" }, { status: 400 });
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
    const outletId = await assertOrgOutlet(
      a.auth.organizationId,
      (body.outlet_id as string) ?? null,
      {
        required: true,
      },
    );
    const existing = await db()
      .select({ id: floors.id })
      .from(floors)
      .where(and(eq(floors.organizationId, a.auth.organizationId), eq(floors.outletId, outletId!)));
    const [created] = await db()
      .insert(floors)
      .values({
        id: ulid(),
        organizationId: a.auth.organizationId,
        outletId: outletId!,
        name,
        code: code.toUpperCase(),
        description: (body.description as string) ?? null,
        level: Number(body.level ?? 0),
        capacity: Number(body.capacity ?? 20),
        sortOrder: (body.sort_order as number | undefined) ?? existing.length,
        isActive: body.is_active !== false,
        isOutdoor: body.is_outdoor === true,
        widthMm: Number(body.width_mm ?? 12000),
        heightMm: Number(body.height_mm ?? 8000),
        gridSizeMm: Number(body.grid_size_mm ?? 100),
        backgroundColor: (body.background_color as string) ?? null,
        backgroundImageUrl: (body.background_image_url as string) ?? null,
      })
      .returning();
    const row = created as unknown as Record<string, unknown>;
    await recordServerEvent({
      outlet_id: outletId!,
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: String(row.id),
      event_type: "FLOOR_CREATED",
      to_state: "ACTIVE",
      actor_id: a.auth.userId,
      metadata: { name, code },
    });
    return NextResponse.json({ ok: true, id: row.id, row }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create floor");
  }
}

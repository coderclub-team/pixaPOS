import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { recordServerEvent } from "@/features/events/api/server";
import { createTable, getTables } from "@/features/table/api/server";

export const dynamic = "force-dynamic";

/** GET /api/tables?outlet_id=&floor_id=&status=&is_active=&search= — tables with derived occupancy. */
export async function GET(req: Request) {
  const a = await authz();
  if ("error" in a) return a.error;
  const q = new URL(req.url).searchParams;
  try {
    const outletId = await assertOrgOutlet(a.auth.organizationId, q.get("outlet_id"));
    const isActive = q.get("is_active");
    const rows = await getTables(a.auth.organizationId, {
      ...(outletId ? { outlet_id: outletId } : {}),
      floor_id: q.get("floor_id") ?? undefined,
      status:
        (q.get("status") as
          | "available"
          | "occupied"
          | "reserved"
          | "cleaning"
          | "out_of_service"
          | undefined) ?? undefined,
      is_active: isActive === "true" ? true : isActive === "false" ? false : undefined,
      search: q.get("search") ?? undefined,
    });
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toHttpError(e, "failed to list tables");
  }
}

/** POST /api/tables — create a table (org:tables:manage). */
export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.tablesManage);
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
      body.outlet_id as string | undefined,
      {
        required: true,
      },
    );
    if (!body.floor_id || typeof body.floor_id !== "string")
      return NextResponse.json({ error: "floor_id is required" }, { status: 400 });
    if (!body.number || typeof body.number !== "string" || !body.number.trim())
      return NextResponse.json({ error: "number is required" }, { status: 400 });
    if (!body.code || typeof body.code !== "string" || !body.code.trim())
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1)
      return NextResponse.json({ error: "capacity must be a positive integer" }, { status: 400 });
    const row = await createTable(
      {
        outlet_id: outletId!,
        floor_id: String(body.floor_id),
        number: String(body.number),
        code: String(body.code),
        capacity,
        shape: body.shape as
          | "square"
          | "round"
          | "rectangle"
          | "triangle"
          | "ellipse"
          | "half_circle"
          | undefined,
        type: body.type as
          | "standard"
          | "bar_counter"
          | "communal"
          | "outdoor"
          | "private"
          | undefined,
        allows_sharing: body.allows_sharing as boolean | undefined,
        is_active: typeof body.is_active === "boolean" ? (body.is_active as boolean) : undefined,
        sort_order: typeof body.sort_order === "number" ? (body.sort_order as number) : undefined,
        x_mm: typeof body.x_mm === "number" ? (body.x_mm as number) : undefined,
        y_mm: typeof body.y_mm === "number" ? (body.y_mm as number) : undefined,
        w_mm: typeof body.w_mm === "number" ? (body.w_mm as number) : undefined,
        h_mm: typeof body.h_mm === "number" ? (body.h_mm as number) : undefined,
        rotation_deg:
          typeof body.rotation_deg === "number" ? (body.rotation_deg as number) : undefined,
        z_index: typeof body.z_index === "number" ? (body.z_index as number) : undefined,
      },
      { organizationId: a.auth.organizationId, actorId: a.auth.userId },
    );
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to create table");
  }
}

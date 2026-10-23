import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, floors } from "@pixa/db";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { recordServerEvent } from "@/features/events/api/server";

export const dynamic = "force-dynamic";

/** POST /api/floors/reorder — bulk sort_order updates [{ floor_id, sort_order }]. */
export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.floorsManage);
  if ("error" in a) return a.error;
  let body: { items?: { floor_id: string; sort_order: number }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "items required" }, { status: 400 });
  try {
    let outletId: string | null = null;
    for (const item of items) {
      if (!item?.floor_id || typeof item.sort_order !== "number") continue;
      const updated = await db()
        .update(floors)
        .set({ sortOrder: item.sort_order, updatedAt: new Date() })
        .where(
          and(
            eq(floors.id, String(item.floor_id)),
            eq(floors.organizationId, a.auth.organizationId),
          ),
        )
        .returning({ outletId: floors.outletId });
      if (updated[0]?.outletId && !outletId) outletId = updated[0].outletId;
    }
    await recordServerEvent({
      outlet_id: outletId ?? "",
      organization_id: a.auth.organizationId,
      entity_type: "FLOOR",
      entity_id: "global",
      event_type: "FLOOR_REORDERED",
      actor_id: a.auth.userId,
    });
    return NextResponse.json({ ok: true, updated: items.length });
  } catch (e) {
    return toHttpError(e, "failed to reorder floors");
  }
}

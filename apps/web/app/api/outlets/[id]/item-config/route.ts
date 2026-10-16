import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, outlets, outletItemConfig, menuItems } from "@pixa/db";
import { baHas, baOrgId, baSession } from "@pixa/server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/outlets/:id/item-config — per-outlet override over a shared
 * logical item (price / active / channels / tax). Upserts on
 * (outlet_id, source_item_id) so retries are idempotent.
 * Requires org:menu:manage. Server validates outlet and item both belong
 * to the caller's org — cross-org mapping is rejected.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: outletId } = await ctx.params;
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId)
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  if (!(await baHas("org:menu:manage").catch(() => false))) {
    return NextResponse.json({ error: "forbidden: menu manage required" }, { status: 403 });
  }
  let body: {
    source_item_id?: string;
    price?: number | null;
    is_active?: boolean | null;
    channels?: string[] | null;
    tax_override?: number | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const sourceItemId = String(body.source_item_id ?? "").trim();
  if (!sourceItemId)
    return NextResponse.json({ error: "source_item_id required" }, { status: 400 });
  try {
    const database = db();
    const outletRows = await database
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.organizationId, organizationId), eq(outlets.id, outletId)))
      .limit(1);
    if (outletRows.length === 0) {
      return NextResponse.json({ error: "outlet not in organization" }, { status: 403 });
    }
    const itemRows = await database
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.organizationId, organizationId), eq(menuItems.id, sourceItemId)))
      .limit(1);
    if (itemRows.length === 0) {
      return NextResponse.json({ error: "item not in organization" }, { status: 403 });
    }
    await database
      .insert(outletItemConfig)
      .values({
        outletId,
        sourceItemId,
        price: body.price ?? null,
        isActive: body.is_active ?? null,
        channels: body.channels ?? null,
        taxOverride: body.tax_override ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [outletItemConfig.outletId, outletItemConfig.sourceItemId],
        set: {
          price: body.price ?? null,
          isActive: body.is_active ?? null,
          channels: body.channels ?? null,
          taxOverride: body.tax_override ?? null,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to save config" }, { status: 500 });
  }
}

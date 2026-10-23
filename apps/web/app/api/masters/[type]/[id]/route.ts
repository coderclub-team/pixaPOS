import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, menuVariants } from "@pixa/db";
import { baHas, baOrgId, baSession } from "@pixa/server";
import { MASTER_REGISTRY, MASTER_TYPES, type MasterType } from "@/lib/masters/registry";

export const dynamic = "force-dynamic";

function resolveType(raw: string): MasterType | null {
  return (MASTER_TYPES as string[]).includes(raw) ? (raw as MasterType) : null;
}

async function authz(permission?: string): Promise<{ organizationId: string } | NextResponse> {
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
  if (permission && !(await baHas(permission).catch(() => false))) {
    return NextResponse.json({ error: `forbidden: ${permission} required` }, { status: 403 });
  }
  return { organizationId };
}

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** GET /api/masters/:type/:id — single row. Items include their variants. */
export async function GET(_req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const a = await authz();
  if (a instanceof NextResponse) return a;
  const entry = MASTER_REGISTRY[type];
  try {
    const rows = (await db()
      .select()
      .from(entry.table)
      .where(and(eq(entry.table.id, id), eq(entry.table.organizationId, a.organizationId)))
      .limit(1)) as Record<string, unknown>[];
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const row: Record<string, unknown> = { ...(rows[0] as object) };
    if (type === "items") {
      const variants = await db()
        .select()
        .from(menuVariants)
        .where(
          and(eq(menuVariants.menuItemId, id), eq(menuVariants.organizationId, a.organizationId)),
        );
      row.variants = variants;
    }
    return NextResponse.json({ row }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to load master" }, { status: 500 });
  }
}

/** PATCH /api/masters/:type/:id — update registry columns. */
export async function PATCH(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const entry = MASTER_REGISTRY[type];
  const a = await authz(entry.permission);
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const col of entry.columns) {
      if (col !== "name" && body[col] !== undefined) values[toCamel(col)] = body[col];
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) return NextResponse.json({ error: "name too short" }, { status: 400 });
      values.name = name;
    }
    const updated = await db()
      .update(entry.table)
      .set(values)
      .where(and(eq(entry.table.id, id), eq(entry.table.organizationId, a.organizationId)))
      .returning({ id: entry.table.id });
    if (!updated.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, id: updated[0].id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to update master" }, { status: 500 });
  }
}

/** DELETE /api/masters/:type/:id — hard delete + mapping rows.
 * Variants/modifiers cascade via FK. Referenced-by-FK rows (e.g. categories
 * with items) return 409 — unmap or move dependents first. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const { type: rawType, id } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const entry = MASTER_REGISTRY[type];
  const a = await authz(entry.permission);
  if (a instanceof NextResponse) return a;
  try {
    if (entry.outletMap) {
      await db()
        .delete(entry.outletMap.table)
        .where(
          and(
            eq(entry.outletMap.table.organizationId, a.organizationId),
            eq(entry.outletMap.table.entityId, id),
          ),
        );
    }
    const deleted = await db()
      .delete(entry.table)
      .where(and(eq(entry.table.id, id), eq(entry.table.organizationId, a.organizationId)))
      .returning({ id: entry.table.id });
    if (!deleted.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, id: deleted[0].id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    if (/foreign key|violates|restrict/i.test(msg))
      return NextResponse.json(
        { error: "in use — unmap or move dependent rows first" },
        { status: 409 },
      );
    return NextResponse.json({ error: "failed to delete master" }, { status: 500 });
  }
}

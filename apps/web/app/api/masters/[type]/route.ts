import { NextResponse } from "next/server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { db, outlets } from "@pixa/db";
import { ulid } from "@pixa/contracts";
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

/** GET /api/masters/:type — org-shared master rows. Any org member may read.
 * With `?outlet_id=`, only rows mapped to that outlet are returned (shared
 * masters, per-outlet availability). Types without a mapping table
 * (variants, modifiers) resolve through their parent (item, group). */
export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const a = await authz();
  if (a instanceof NextResponse) return a;
  const outletId = new URL(req.url).searchParams.get("outlet_id") ?? undefined;
  try {
    if (outletId) {
      const outlet = await db()
        .select({ id: outlets.id })
        .from(outlets)
        .where(and(eq(outlets.id, outletId), eq(outlets.organizationId, a.organizationId)))
        .limit(1);
      if (!outlet.length) return NextResponse.json({ error: "unknown outlet" }, { status: 400 });
    }
    const entry = MASTER_REGISTRY[type];
    let rows: Record<string, unknown>[];
    if (outletId && entry.outletMap) {
      rows = (await db()
        .select({ ...getTableColumns(entry.table) })
        .from(entry.table)
        .innerJoin(
          entry.outletMap.table,
          and(
            eq(entry.outletMap.table.entityId, entry.table.id),
            eq(entry.outletMap.table.outletId, outletId),
            eq(entry.outletMap.table.organizationId, a.organizationId),
          ),
        )
        .where(eq(entry.table.organizationId, a.organizationId))
        .limit(2000)) as Record<string, unknown>[];
    } else if (outletId && type === "variants") {
      const { menuItems, outletMenuItems } = await import("@pixa/db");
      rows = (await db()
        .select({ ...getTableColumns(entry.table) })
        .from(entry.table)
        .innerJoin(menuItems, eq(menuItems.id, entry.table.menuItemId))
        .innerJoin(
          outletMenuItems,
          and(
            eq(outletMenuItems.entityId, menuItems.id),
            eq(outletMenuItems.outletId, outletId),
            eq(outletMenuItems.organizationId, a.organizationId),
          ),
        )
        .where(eq(entry.table.organizationId, a.organizationId))
        .limit(2000)) as Record<string, unknown>[];
    } else if (outletId && type === "modifiers") {
      const { modifierGroups, outletModifierGroups } = await import("@pixa/db");
      rows = (await db()
        .select({ ...getTableColumns(entry.table) })
        .from(entry.table)
        .innerJoin(modifierGroups, eq(modifierGroups.id, entry.table.groupId))
        .innerJoin(
          outletModifierGroups,
          and(
            eq(outletModifierGroups.entityId, modifierGroups.id),
            eq(outletModifierGroups.outletId, outletId),
            eq(outletModifierGroups.organizationId, a.organizationId),
          ),
        )
        .where(eq(entry.table.organizationId, a.organizationId))
        .limit(2000)) as Record<string, unknown>[];
    } else {
      rows = await db()
        .select()
        .from(entry.table)
        .where(eq(entry.table.organizationId, a.organizationId))
        .limit(2000);
    }
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list masters" }, { status: 500 });
  }
}

/** POST /api/masters/:type — create an org-shared master row.
 * Accepts optional `outlet_ids: string[]` to scope availability (validated
 * against the org's outlets). Without it, the row is mapped to every outlet
 * of the org — preserving the legacy visible-everywhere behavior. A scalar
 * `outlet_id` is rejected: availability is a multi-outlet relationship, not
 * a single-outlet column. */
export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const entry = MASTER_REGISTRY[type];
  const a = await authz(entry.permission);
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  if (name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });
  if (body.outlet_id !== undefined && body.outlet_id !== null) {
    return NextResponse.json(
      { error: "pass outlet_ids (array) instead — availability is a multi-outlet relationship" },
      { status: 400 },
    );
  }
  try {
    const values: Record<string, unknown> = {
      id: ulid(),
      organizationId: a.organizationId,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    for (const col of entry.columns) {
      if (col === "name" || body[col] === undefined) continue;
      values[toCamel(col)] = body[col];
    }
    await db().insert(entry.table).values(values);
    if (entry.outletMap) {
      const requested = Array.isArray(body.outlet_ids)
        ? [...new Set(body.outlet_ids.map(String))]
        : null;
      const allOutlets = await db()
        .select({ id: outlets.id })
        .from(outlets)
        .where(eq(outlets.organizationId, a.organizationId));
      const valid = new Set(allOutlets.map((o) => o.id));
      const target = requested ?? [...valid];
      const unknown = target.filter((id) => !valid.has(id));
      if (unknown.length) {
        return NextResponse.json(
          { error: `unknown outlet(s): ${unknown.join(", ")}` },
          { status: 400 },
        );
      }
      for (const outletId of target) {
        await db()
          .insert(entry.outletMap.table)
          .values({
            id: ulid(),
            organizationId: a.organizationId,
            outletId,
            entityId: values.id,
            createdAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }
    return NextResponse.json({ ok: true, id: values.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to create master" }, { status: 500 });
  }
}

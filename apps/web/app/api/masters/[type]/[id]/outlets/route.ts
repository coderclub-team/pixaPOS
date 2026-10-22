import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

async function outletIdsOf(orgId: string): Promise<Set<string>> {
  const rows = await db()
    .select({ id: outlets.id })
    .from(outlets)
    .where(eq(outlets.organizationId, orgId));
  return new Set(rows.map((r) => r.id));
}

/** GET /api/masters/:type/:id/outlets — outlet ids this master is available at. */
export async function GET(_req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const a = await authz();
  if (a instanceof NextResponse) return a;
  const entry = MASTER_REGISTRY[type];
  if (!entry.outletMap) {
    return NextResponse.json(
      { error: `${type} inherits availability from its parent — no direct mappings` },
      { status: 400 },
    );
  }
  try {
    const rows = await db()
      .select({ outletId: entry.outletMap.table.outletId })
      .from(entry.outletMap.table)
      .where(
        and(
          eq(entry.outletMap.table.organizationId, a.organizationId),
          eq(entry.outletMap.table.entityId, id),
        ),
      );
    return NextResponse.json(
      { outlet_ids: rows.map((r) => r.outletId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "failed to list outlet mappings" }, { status: 500 });
  }
}

/** PUT /api/masters/:type/:id/outlets — replace outlet availability. */
export async function PUT(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const entry = MASTER_REGISTRY[type];
  if (!entry.outletMap) {
    return NextResponse.json(
      { error: `${type} inherits availability from its parent — no direct mappings` },
      { status: 400 },
    );
  }
  const a = await authz(entry.permission);
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.outlet_ids)) {
    return NextResponse.json({ error: "outlet_ids (array) required" }, { status: 400 });
  }
  try {
    const existing = await db()
      .select({ id: entry.table.id })
      .from(entry.table)
      .where(and(eq(entry.table.id, id), eq(entry.table.organizationId, a.organizationId)))
      .limit(1);
    if (!existing.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const valid = await outletIdsOf(a.organizationId);
    const target = [...new Set((body.outlet_ids as unknown[]).map(String))];
    const unknown = target.filter((x) => !valid.has(x));
    if (unknown.length) {
      return NextResponse.json(
        { error: `unknown outlet(s): ${unknown.join(", ")}` },
        { status: 400 },
      );
    }
    await db()
      .delete(entry.outletMap.table)
      .where(
        and(
          eq(entry.outletMap.table.organizationId, a.organizationId),
          eq(entry.outletMap.table.entityId, id),
        ),
      );
    for (const outletId of target) {
      await db()
        .insert(entry.outletMap.table)
        .values({
          id: ulid(),
          organizationId: a.organizationId,
          outletId,
          entityId: id,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }
    return NextResponse.json({ ok: true, outlet_ids: target });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to update outlet mappings" }, { status: 500 });
  }
}

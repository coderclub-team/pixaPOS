import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@pixa/db";
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

/** GET /api/masters/:type — org-shared master rows. Any org member may read. */
export async function GET(_req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await ctx.params;
  const type = resolveType(rawType);
  if (!type) return NextResponse.json({ error: "unknown master type" }, { status: 404 });
  const a = await authz();
  if (a instanceof NextResponse) return a;
  try {
    const entry = MASTER_REGISTRY[type];
    const rows = await db()
      .select()
      .from(entry.table)
      .where(eq(entry.table.organizationId, a.organizationId))
      .limit(2000);
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list masters" }, { status: 500 });
  }
}

/** POST /api/masters/:type — create an org-shared master row. outlet_id is rejected. */
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
      { error: "masters are org-shared; per-outlet differences belong in outlet_item_config" },
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
    return NextResponse.json({ ok: true, id: values.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to create master" }, { status: 500 });
  }
}

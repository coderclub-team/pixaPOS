import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db, outlets } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { auth } from "@pixa/server";
import { baHas, baOrgId } from "@pixa/server";
import { baMember } from "@pixa/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  let session = null;
  try {
    session = await auth.api.getSession({ headers: (await headers()) as unknown as Headers });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const activeOrg =
    (session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
    null;
  let orgIds: string[] = activeOrg ? [activeOrg] : [];
  if (orgIds.length === 0) {
    const mems = await db()
      .select({ organizationId: baMember.organizationId })
      .from(baMember)
      .where(eq(baMember.userId, session.user.id));
    orgIds = mems.map((m) => m.organizationId);
  }
  if (orgIds.length === 0) {
    console.warn("[api/outlets] no organization for user", session.user.id);
    return NextResponse.json(
      { outlets: [], noOrganization: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const database = db();
    // NOTE: neon-http can't bind JS arrays (ANY($1) → malformed array
    // literal), so use inArray() which expands to individual params.
    // NOTE: no auto-creation here — an empty outlet list stays empty.
    // Outlets are created only via POST (user action) or migration seeds.
    const dbRows = await database
      .select({
        id: outlets.id,
        organization_id: outlets.organizationId,
        name: outlets.name,
        code: outlets.code,
        is_active: outlets.isActive,
        created_at: outlets.createdAt,
      })
      .from(outlets)
      .where(inArray(outlets.organizationId, orgIds))
      .orderBy(outlets.name);
    const rows = dbRows.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.() ?? null }));
    console.info(
      `[api/outlets] orgs=${orgIds.join(",")} rows=${rows.length} user=${session.user.id}`,
    );
    return NextResponse.json({ outlets: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(
      "[api/outlets] failed for user",
      session.user.id,
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json({ outlets: [] });
  }
}

function slugCode(name: string): string {
  const code = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return code || "OUT";
}

/**
 * POST /api/outlets — add an outlet to the caller's organization.
 * Requires org:outlet:manage. Seeds default kitchen stations (Main Kitchen,
 * Bar) so KOT routing works immediately. Codes are unique per organization
 * (outlets_org_code_uidx) — public QR/kiosk use a separate publicSlug if
 * globally unique URLs are needed; terminal URLs now carry org+outlet ids.
 */
export async function POST(req: Request) {
  let body: { name?: string; code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });

  let sessionUser: string | null = null;
  try {
    const s = await auth.api.getSession({ headers: (await headers()) as unknown as Headers });
    sessionUser = s?.user?.id ?? null;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await baHas("org:outlet:manage").catch(() => false))) {
    return NextResponse.json({ error: "forbidden: outlet manage required" }, { status: 403 });
  }
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId) {
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  }

  const baseCode = (body.code ?? slugCode(name)).trim().toUpperCase().slice(0, 12);
  if (!baseCode) return NextResponse.json({ error: "code required" }, { status: 400 });

  const database = db();
  const id = ulid();
  let code = baseCode;
  let created = false;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    code = attempt === 0 ? baseCode : `${baseCode}${attempt + 1}`.slice(0, 12);
    try {
      await database.execute(
        sql`INSERT INTO outlets (id, organization_id, name, code, is_active, created_at, updated_at)
            VALUES (${id}, ${organizationId}, ${name}, ${code}, true, now(), now())`,
      );
      created = true;
    } catch (e) {
      lastError = e;
    }
  }
  if (!created) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "outlet code already exists" }, { status: 409 });
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to create outlet" }, { status: 500 });
  }

  // Seed default kitchen stations (best-effort; outlet works without them).
  try {
    const defaults = [
      { name: "Main Kitchen", code: "KITCHEN", order: 0 },
      { name: "Bar", code: "BAR", order: 1 },
    ];
    for (const d of defaults) {
      await database
        .execute(
          sql`INSERT INTO outlet_kitchen_stations (id, organization_id, outlet_id, name, code, display_order, is_active, created_at, updated_at)
              VALUES (${ulid()}, ${organizationId}, ${id}, ${d.name}, ${d.code}, ${d.order}, true, now(), now())
              ON CONFLICT DO NOTHING`,
        )
        .catch(() => {});
    }
  } catch {
    /* stations table may be unmigrated — ignore */
  }

  return NextResponse.json(
    { ok: true, id, organization_id: organizationId, name, code },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

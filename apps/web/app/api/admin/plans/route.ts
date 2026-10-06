import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { FEATURES, RESOURCE_LIMITS, saasPlans } from "@pixa/db";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9-]{2,40}$/;

function parseFeatures(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((f) => String(f).trim())
    .filter(Boolean)
    .slice(0, 30);
  return list;
}

/** Normalize an incoming limits map to every ResourceLimit key (number|null). */
function parseLimits(raw: unknown): Record<string, number | null> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number | null> = {};
  for (const key of RESOURCE_LIMITS) {
    const v = obj[key];
    if (v === null || v === undefined || v === "") out[key] = null;
    else out[key] = Math.max(0, Math.floor(Number(v) || 0));
  }
  return out;
}

/** Feature flags default to all-true (no feature gating between plans). */
function parseFlags(raw: unknown): Record<string, boolean> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const key of FEATURES) out[key] = obj[key] === undefined ? true : Boolean(obj[key]);
  return out;
}

/**
 * Public catalog read for marketing/site sync and admin plan views. Reads are
 * intentionally unauthenticated so plan metadata, pricing and annual discount
 * data stay in sync without a login gate.
 */
export async function GET() {
  try {
    const rows = await adminDb()
      .select()
      .from(saasPlans)
      .orderBy(asc(saasPlans.sortOrder), asc(saasPlans.name));
    return NextResponse.json({
      ok: true,
      plans: rows.map((p) => ({
        ...p,
        annualDiscountPct: Number(p.annualDiscountPct ?? 0),
        features: JSON.parse(p.features ?? "[]"),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["plans:manage"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "")
    .trim()
    .toLowerCase();
  const name = String(body?.name ?? "").trim();
  const features = parseFeatures(body?.features);
  if (!ID.test(id))
    return NextResponse.json({ ok: false, error: "id: 2-40 lowercase slug" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!features)
    return NextResponse.json({ ok: false, error: "features must be an array" }, { status: 400 });
  const monthlyPaise =
    body?.monthlyPaise === null || body?.monthlyPaise === undefined
      ? null
      : Math.max(0, Math.floor(Number(body.monthlyPaise) || 0));
  try {
    const db = adminDb();
    const existing = await db
      .select({ id: saasPlans.id })
      .from(saasPlans)
      .where(eq(saasPlans.id, id))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "plan id taken" }, { status: 409 });
    }
    await db.insert(saasPlans).values({
      id,
      name: name.slice(0, 60),
      tagline: String(body?.tagline ?? "").slice(0, 200) || null,
      monthlyPaise,
      annualDiscountPct: Math.min(
        90,
        Math.max(0, Math.floor(Number(body?.annualDiscountPct ?? 0) || 0)),
      ),
      features: JSON.stringify(features),
      limits: JSON.stringify(parseLimits(body?.limits)),
      flags: JSON.stringify(parseFlags(body?.flags)),
      outletLimit:
        body?.outletLimit === null || body?.outletLimit === undefined
          ? parseLimits(body?.limits).outlets
          : Math.max(1, Math.floor(Number(body.outletLimit) || 1)),
      sortOrder: Math.floor(Number(body?.sortOrder ?? 0) || 0),
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
    });
    await auditOwnerAction(auth.owner, "plan", id, "PLAN_CREATED", name);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

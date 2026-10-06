import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { FEATURES, RESOURCE_LIMITS, orgProfiles, saasPlans } from "@pixa/db";

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

function parseFlags(raw: unknown): Record<string, boolean> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const key of FEATURES) out[key] = obj[key] === undefined ? true : Boolean(obj[key]);
  return out;
}

/**
 * PATCH a plan. Plans are never deleted while referenced — deactivate
 * instead (history + orgProfiles.plan keep resolving). Deactivation is
 * refused while any org sits on the plan.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["plans:manage"]);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    patch.name = name.slice(0, 60);
  }
  if (body?.tagline !== undefined) patch.tagline = String(body.tagline).slice(0, 200) || null;
  if (body?.monthlyPaise !== undefined) {
    patch.monthlyPaise =
      body.monthlyPaise === null ? null : Math.max(0, Math.floor(Number(body.monthlyPaise) || 0));
  }
  if (body?.annualDiscountPct !== undefined) {
    patch.annualDiscountPct = Math.min(
      90,
      Math.max(0, Math.floor(Number(body.annualDiscountPct) || 0)),
    );
  }
  if (body?.features !== undefined) {
    if (!Array.isArray(body.features)) {
      return NextResponse.json({ ok: false, error: "features must be an array" }, { status: 400 });
    }
    patch.features = JSON.stringify(
      body.features
        .map((f: unknown) => String(f).trim())
        .filter(Boolean)
        .slice(0, 30),
    );
  }
  if (body?.outletLimit !== undefined) {
    patch.outletLimit =
      body.outletLimit === null ? null : Math.max(1, Math.floor(Number(body.outletLimit) || 1));
  }
  if (body?.limits !== undefined) {
    const limits = parseLimits(body.limits);
    patch.limits = JSON.stringify(limits);
    patch.outletLimit = limits.outlets;
  }
  if (body?.flags !== undefined) patch.flags = JSON.stringify(parseFlags(body.flags));
  if (body?.sortOrder !== undefined) patch.sortOrder = Math.floor(Number(body.sortOrder) || 0);
  if (Object.keys(patch).length === 0 && body?.isActive === undefined) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }
  try {
    const db = adminDb();
    if (body?.isActive === false) {
      const refs = await db
        .select({ organizationId: orgProfiles.organizationId })
        .from(orgProfiles)
        .where(eq(orgProfiles.plan, id))
        .limit(1);
      if (refs.length > 0) {
        return NextResponse.json(
          { ok: false, error: "plan in use — move orgs off it first" },
          { status: 409 },
        );
      }
      patch.isActive = false;
    } else if (body?.isActive === true) {
      patch.isActive = true;
    }
    await db
      .update(saasPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(saasPlans.id, id));
    await auditOwnerAction(
      auth.owner,
      "plan",
      id,
      "PLAN_UPDATED",
      JSON.stringify(patch).slice(0, 500),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

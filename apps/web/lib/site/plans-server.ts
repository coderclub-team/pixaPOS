/**
 * Server-only marketing plan loader: reads the owner-managed catalog from the
 * DB (`saas_plans`) so the landing page shows exactly what admins edit. Falls
 * back to the static `PLANS` when the DB is unavailable at render time.
 */
import { adminDb } from "@/lib/saas-admin";
import { saasPlans } from "@pixa/db";
import { resolveLimits, type LimitMap } from "@pixa/db/plans";
import { PLANS as STATIC_PLANS, type Plan } from "./plans";

function parseArray(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export async function getMarketingPlans(): Promise<Plan[]> {
  try {
    const rows = await adminDb()
      .select()
      .from(saasPlans)
      .orderBy(saasPlans.sortOrder, saasPlans.name);
    const active = rows.filter((p) => p.isActive);
    if (active.length === 0) return STATIC_PLANS;
    return active.map((p) => {
      let dbLimits: Partial<LimitMap> | null = null;
      try {
        dbLimits = p.limits ? (JSON.parse(p.limits) as Partial<LimitMap>) : null;
      } catch {
        dbLimits = null;
      }
      const custom = p.monthlyPaise === null;
      return {
        id: p.id,
        name: p.name,
        tagline: p.tagline ?? "",
        monthly_paise: p.monthlyPaise,
        annual_discount_pct: p.annualDiscountPct,
        cta: custom ? "Talk to sales" : "Start 14-day free trial",
        ctaHref: custom ? "/#contact" : undefined,
        featured: p.id === "growth",
        features: parseArray(p.features),
        limits: resolveLimits(p.id, dbLimits),
      } satisfies Plan;
    });
  } catch {
    return STATIC_PLANS;
  }
}

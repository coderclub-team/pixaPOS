import { adminDb } from "@/lib/saas-admin";
import { orgProfiles, saasPlans } from "@pixa/db";
import { resolveLimits, type LimitMap } from "@pixa/db/plans";
import { Alert, AlertDescription, AlertTitle } from "@pixa/ui/base-ui/alert";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { getUsdToInr } from "@/lib/fx";
import { PlansTable, type CatalogPlan } from "./table";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  let plans: CatalogPlan[] = [];
  const limitsById: Record<string, LimitMap> = {};
  const dist: Record<string, number> = {};
  try {
    const db = adminDb();
    const rows = await db.select().from(saasPlans).orderBy(saasPlans.sortOrder, saasPlans.name);
    plans = rows.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      monthlyPaise: p.monthlyPaise,
      annualDiscountPct: p.annualDiscountPct,
      features: JSON.parse(p.features ?? "[]") as string[],
      outletLimit: p.outletLimit,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    }));
    for (const p of rows) {
      let dbLimits: Partial<LimitMap> | null = null;
      try {
        dbLimits = p.limits ? (JSON.parse(p.limits) as Partial<LimitMap>) : null;
      } catch {
        dbLimits = null;
      }
      limitsById[p.id] = resolveLimits(p.id, dbLimits);
    }
    const profiles = await db.select().from(orgProfiles);
    for (const p of profiles) {
      dist[p.plan ?? ""] = (dist[p.plan ?? ""] ?? 0) + 1;
    }
  } catch {
    /* render empty catalog when DB is down */
  }
  const known = new Set(plans.map((p) => p.id));
  const orphaned = Object.entries(dist).filter(([id]) => !known.has(id));
  const fx = await getUsdToInr();
  return (
    <PageContainer
      pageTitle="Plans & billing"
      pageDescription="Owner-managed plan catalog — the single source of truth. Pricing, limits, feature flags and infrastructure cost/margin per plan."
    >
      <div className="space-y-6">
        {orphaned.length > 0 && (
          <Alert>
            <Icons.warning className="size-4" aria-hidden />
            <AlertTitle>Unknown plans in use</AlertTitle>
            <AlertDescription>
              Orgs on unknown plans: {orphaned.map(([id, n]) => `${id} (${n})`).join(", ")} — assign
              them a catalog plan from the organisation page.
            </AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          Cost &amp; margin use live USD→INR {fx.rate.toFixed(2)}
          {fx.source === "live" ? (fx.updatedAt ? ` (${fx.updatedAt})` : "") : " (fallback)"}. Use a
          plan&apos;s row actions for cost &amp; margins.
        </p>
        <PlansTable initial={plans} limitsById={limitsById} usdToInr={fx.rate} />
      </div>
    </PageContainer>
  );
}

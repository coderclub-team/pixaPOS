import { adminDb } from "@/lib/saas-admin";
import { orgProfiles, saasPlans } from "@pixa/db";
import { Alert, AlertDescription, AlertTitle } from "@pixa/ui/base-ui/alert";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { PlansManager } from "./plans-manager";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  let plans: React.ComponentProps<typeof PlansManager>["initialPlans"] = [];
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
    const profiles = await db.select().from(orgProfiles);
    for (const p of profiles) {
      dist[p.plan ?? ""] = (dist[p.plan ?? ""] ?? 0) + 1;
    }
  } catch {
    /* render empty catalog when DB is down */
  }
  const known = new Set(plans.map((p) => p.id));
  const orphaned = Object.entries(dist).filter(([id]) => !known.has(id));
  return (
    <PageContainer
      pageTitle="Plans & billing"
      pageDescription="Owner-managed plan catalog — the single source of truth. Razorpay reconciliation stays in the web app; this is the owner overview."
    >
      <div className="space-y-5">
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
        <PlansManager initialPlans={plans} />
      </div>
    </PageContainer>
  );
}

import { adminDb } from "@/lib/saas-admin";
import { orgProfiles, saasPlans } from "@pixa/db";
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans & billing</h1>
        <p className="text-sm text-zinc-600">
          Owner-managed plan catalog — the single source of truth. Razorpay reconciliation stays in
          the web app; this is the owner overview.
        </p>
      </div>
      {orphaned.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Orgs on unknown plans: {orphaned.map(([id, n]) => `${id} (${n})`).join(", ")} — assign
          them a catalog plan from the organisation page.
        </p>
      )}
      <PlansManager initialPlans={plans} />
    </div>
  );
}

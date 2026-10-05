import { adminDb } from "@/lib/db";
import { orgProfiles } from "@pixa/db";

export const dynamic = "force-dynamic";

const PLANS = [
  { name: "Starter", price: "₹999/mo", features: ["1 outlet", "POS + KDS", "Email support"] },
  {
    name: "Growth",
    price: "₹2,499/mo",
    features: ["Up to 5 outlets", "Inventory + reports", "Priority support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: ["Unlimited outlets", "SSO + audit", "Dedicated CSM"],
  },
];

export default async function BillingPage() {
  let dist: Record<string, number> = {};
  try {
    const profiles = await adminDb().select().from(orgProfiles);
    for (const p of profiles) dist[p.plan ?? "starter"] = (dist[p.plan ?? "starter"] ?? 0) + 1;
  } catch {
    /* show static plans when DB is down */
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans & billing</h1>
        <p className="text-sm text-zinc-600">
          Plan mix across organisations. Razorpay reconciliation stays in the web app; this is the
          owner overview.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className="rounded-xl border bg-white p-5">
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-2xl font-semibold">{p.price}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {dist[p.name.toLowerCase()] ?? 0} orgs on this plan
            </p>
            <ul className="mt-3 space-y-1 text-sm text-zinc-700">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

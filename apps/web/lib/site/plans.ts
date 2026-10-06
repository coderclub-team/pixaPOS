/**
 * Plan catalog for the marketing site.
 *
 * SaaS model (restaurant, India-first, Razorpay billing):
 * per-OUTLET/month (fits our multi-outlet architecture — an outlet
 * is an operational entity under one subscription, never the subscriber),
 * ~20% annual discount, 14-day full-feature trial with no card.
 * Trial lapse locks the workspace until a plan is chosen (no free tier yet).
 *
 * TODO(canonical): move this catalog into @pixa/contracts (billing plans)
 * so apps/web checkout reads the same source instead of duplicating it.
 */
export type BillingCycle = "monthly" | "annual";

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly_paise: number | null; // null = custom (talk to sales)
  annual_discount_pct: number;
  cta: string;
  /** Optional CTA override — e.g. Custom plan goes to contact, not signup. */
  ctaHref?: string;
  featured?: boolean;
  features: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For a single outlet.",
    monthly_paise: 49900,
    annual_discount_pct: 0,
    cta: "Start 14-day free trial",
    features: [
      "1 outlet · 1 register",
      "2 users · 2 devices",
      "500 orders / month",
      "500 MB storage",
      "All features included",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing restaurants, chains & branches.",
    monthly_paise: 199900,
    annual_discount_pct: 20,
    cta: "Start 14-day free trial",
    featured: true,
    features: [
      "Per outlet · unlimited registers",
      "Everything in Starter",
      "Multi-outlet dashboard & reports",
      "Central menu, pricing & tax control",
      "Kiosk, QR ordering, dispatch console",
      "Inventory, batches & wastage",
      "Promos, rewards, customers",
      "Zomato / Swiggy relay",
      "Priority support",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Volume pricing for large chains & franchises.",
    monthly_paise: null,
    annual_discount_pct: 20,
    cta: "Talk to sales",
    ctaHref: "/#contact",
    features: [
      "Everything in Growth",
      "Volume pricing for 5+ outlets",
      "Franchise & head-office controls",
      "SSO, audit trail, API access",
      "Dedicated onboarding manager",
      "SLA + priority support",
    ],
  },
];

export function planPrice(plan: Plan, cycle: BillingCycle): number | null {
  if (plan.monthly_paise == null) return null;
  if (cycle === "monthly") return plan.monthly_paise;
  return Math.round((plan.monthly_paise * (100 - plan.annual_discount_pct)) / 100);
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

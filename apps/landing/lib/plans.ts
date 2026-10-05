/**
 * Plan catalog for the marketing site.
 *
 * SaaS model (verified against Zoho POS and Odoo, 2026):
 * - Zoho POS: per-location/month, Free → Standard → Professional → Premium,
 *   15-day full-feature trial with no card, lapse moves you to Free.
 * - Odoo: per-user/month, One-App-Free → Standard → Custom, ~20% annual
 *   discount, 15-day trial.
 *
 * pixaPOS gap/decision (restaurant, India-first, Razorpay billing):
 * per-OUTLET/month like Zoho (fits our multi-outlet architecture — an outlet
 * is an operational entity under one subscription, never the subscriber),
 * ~20% annual discount like Odoo, 14-day full-feature trial with no card.
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
  monthly_paise: number | null; // null = custom (Scale)
  annual_discount_pct: number;
  cta: string;
  featured?: boolean;
  features: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Free forever for a single counter.",
    monthly_paise: 0,
    annual_discount_pct: 0,
    cta: "Start free",
    features: [
      "1 outlet · 1 register",
      "POS terminal + KDS",
      "Tables, KOT printing",
      "UPI / cash collection",
      "Daily sales reports",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Multi-counter restaurants that deliver.",
    monthly_paise: 199900,
    annual_discount_pct: 20,
    cta: "Start 14-day free trial",
    featured: true,
    features: [
      "Per outlet · unlimited registers",
      "Everything in Starter",
      "Kiosk, QR ordering, dispatch console",
      "Inventory, batches & wastage",
      "Promos, rewards, customers",
      "Zomato / Swiggy relay",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "Chains and franchises.",
    monthly_paise: null,
    annual_discount_pct: 20,
    cta: "Talk to sales",
    features: [
      "Everything in Growth",
      "Multi-outlet management",
      "Roles, audit trail, SSO",
      "API access + webhooks",
      "Onboarding + training",
      "Dedicated manager",
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

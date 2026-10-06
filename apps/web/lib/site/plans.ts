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
import type { LimitMap } from "@pixa/db/plans";

export type BillingCycle = "monthly" | "annual";

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly_paise: number | null; // null = custom (talk to sales)
  annual_discount_pct: number;
  /** Regular annual total (monthly list × 12) before discount. null = custom. */
  regular_paise: number | null;
  /** Effective annual total after the annual discount. null = custom. */
  discount_paise: number | null;
  cta: string;
  /** Optional CTA override — e.g. Custom plan goes to contact, not signup. */
  ctaHref?: string;
  featured?: boolean;
  features: string[];
  /** Plan detail values loaded from the DB catalog when available. */
  limits?: LimitMap;
};

/** Derive the regular vs discounted annual prices from the catalog values. */
export function planPricing(
  monthlyPaise: number | null,
  annualDiscountPct: number,
): { regular_paise: number | null; discount_paise: number | null } {
  if (monthlyPaise == null) return { regular_paise: null, discount_paise: null };
  const regular = monthlyPaise * 12;
  const discount = Math.round((regular * (100 - annualDiscountPct)) / 100);
  return { regular_paise: regular, discount_paise: discount };
}

export const TRIAL_DAYS = 14;

/** Starter and Growth share the full platform feature list (only limits differ). */
export const CORE_FEATURES: string[] = [
  "Multi-outlet dashboard & reports",
  "Central menu, pricing & tax",
  "Free restaurant ecommerce website with delivery radius control",
  "Online ordering, kiosk & QR ordering",
  "Inventory, batches & wastage",
  "Promos, rewards & customers",
  "Zomato / Swiggy relay",
  "Table, counter, takeaway & delivery",
  "KOT, KDS and billing workflow",
  "PWA POS across phone, tablet and desktop",
  "POS, KDS, KOT & tables",
  "UPI / cash collection",
  "Daily sales reports",
];

const RAW_PLANS: Omit<Plan, "regular_paise" | "discount_paise">[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Multi-outlet ready",
    monthly_paise: 39900,
    annual_discount_pct: 25,
    cta: "Start 14-day free trial",
    features: CORE_FEATURES,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Built for multi-outlet restaurant groups",
    monthly_paise: 149900,
    annual_discount_pct: 25,
    cta: "Start 14-day free trial",
    featured: true,
    features: CORE_FEATURES,
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Chains & enterprise",
    monthly_paise: null,
    annual_discount_pct: 25,
    cta: "Talk to sales",
    ctaHref: "/#contact",
    features: [
      "Multi-store chains and franchise groups",
      "Custom workflows, extra data access and integrations",
      "API access, partner integrations and white-labeling",
      "Advanced support and dedicated onboarding",
      "Tailored governance for group operations and reporting",
    ],
  },
];

export const PLANS: Plan[] = RAW_PLANS.map((p) => ({
  ...p,
  ...planPricing(p.monthly_paise, p.annual_discount_pct),
}));

export function sharedAnnualDiscountPct(plans: Plan[]): number {
  const discounts = plans
    .map((plan) => plan.annual_discount_pct)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (discounts.length === 0) return 0;
  const uniqueDiscounts = new Set(discounts);
  return uniqueDiscounts.size === 1 ? discounts[0] : 0;
}

export function planPrice(plan: Plan, cycle: BillingCycle): number | null {
  if (plan.monthly_paise == null) return null;
  if (cycle === "monthly") return plan.monthly_paise;
  return Math.round((plan.monthly_paise * (100 - plan.annual_discount_pct)) / 100);
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

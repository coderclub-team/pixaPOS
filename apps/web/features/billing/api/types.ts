/** SaaS subscription billing (owner-facing). Amounts in integer paise (ADR-0001). */

export type BillingPeriod = "monthly";

export type BillingPlan = {
  id: string;
  name: string;
  billing_period: BillingPeriod;
  /** Tax-exclusive monthly price (Zoho-style); GST applied at invoice render. */
  amount_paise: number;
  currency: "INR";
  trial_days: number;
  grace_days: number;
  features: string[];
};

export const BILLING_PLAN: BillingPlan = {
  id: "pixa_pro_monthly",
  name: "pixaPOS Pro",
  billing_period: "monthly",
  amount_paise: 99900,
  currency: "INR",
  trial_days: 14,
  grace_days: 3,
  features: [
    "Unlimited orders, KOTs and tables",
    "All outlets under one organization",
    "Menu, inventory and supplier ledger",
    "Customers, payments and refunds",
    "GST-ready invoices and reports",
  ],
};

/**
 * GST applied at invoice render on the tax-exclusive plan price.
 * CONFIRM with CA before go-live: assumed 18% SaaS slab for v1 skeleton.
 */
export const BILLING_GST_PERCENT = 18;

export type SubscriptionStatus = "trialing" | "active" | "grace" | "blocked" | "cancelled";

export type Subscription = {
  id: string;
  outlet_id: string;
  plan_id: string;
  /** Trial clock anchor. Pinned first-wins: Better Auth org createdAt when available,
   * else local first-seen (documented tradeoff — a data wipe restarts it). */
  trial_started_at: string;
  razorpay_subscription_id?: string;
  razorpay_customer_id?: string;
  /** Zoho pattern: stays usable until the paid period ends, then cancelled. */
  cancel_at_period_end: boolean;
  current_period_start?: string;
  current_period_end?: string;
  last_payment_at?: string;
  created_at: string;
  updated_at: string;
  version: number;
};

export type InvoiceStatus = "paid" | "pending" | "failed";

export type SubscriptionInvoice = {
  id: string;
  outlet_id: string;
  subscription_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal_paise: number;
  gst_percent: number;
  gst_paise: number;
  total_paise: number;
  status: InvoiceStatus;
  /** Nullable: present once Razorpay is the source (Phase 2 reconciliation). */
  razorpay_invoice_id?: string;
  razorpay_payment_id?: string;
  created_at: string;
};

export type SubscriptionView = {
  subscription: Subscription;
  status: SubscriptionStatus;
  trial_ends_at: string;
  grace_ends_at: string;
  /** Whole days remaining in the current phase (trial or grace). */
  days_left: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure derivation — the single rule for trial → grace → blocked. */
export function deriveSubscriptionView(
  sub: Subscription,
  plan: BillingPlan = BILLING_PLAN,
  nowMs: number = Date.now(),
): SubscriptionView {
  const trialStart = new Date(sub.trial_started_at).getTime();
  const trialEndsAt = new Date(trialStart + plan.trial_days * DAY_MS).toISOString();
  const graceEndsAt = new Date(
    new Date(trialEndsAt).getTime() + plan.grace_days * DAY_MS,
  ).toISOString();

  const hasLiveRazorpay =
    !!sub.razorpay_subscription_id &&
    (!sub.current_period_end || new Date(sub.current_period_end).getTime() > nowMs);

  let status: SubscriptionStatus;
  let days_left: number;
  if (
    sub.cancel_at_period_end &&
    sub.current_period_end &&
    nowMs >= new Date(sub.current_period_end).getTime()
  ) {
    status = "cancelled";
    days_left = 0;
  } else if (hasLiveRazorpay) {
    status = "active";
    days_left = sub.current_period_end
      ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - nowMs) / DAY_MS))
      : 0;
  } else if (nowMs < new Date(trialEndsAt).getTime()) {
    status = "trialing";
    days_left = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - nowMs) / DAY_MS));
  } else if (nowMs < new Date(graceEndsAt).getTime()) {
    status = "grace";
    days_left = Math.max(0, Math.ceil((new Date(graceEndsAt).getTime() - nowMs) / DAY_MS));
  } else {
    status = "blocked";
    days_left = 0;
  }

  return {
    subscription: sub,
    status,
    trial_ends_at: trialEndsAt,
    grace_ends_at: graceEndsAt,
    days_left,
  };
}

/** GST-exclusive price → invoice totals. Rounds GST to the nearest paise. */
export function buildInvoiceTotals(
  subtotal_paise: number,
  gst_percent: number = BILLING_GST_PERCENT,
) {
  const gst_paise = Math.round((subtotal_paise * gst_percent) / 100);
  return { subtotal_paise, gst_percent, gst_paise, total_paise: subtotal_paise + gst_paise };
}

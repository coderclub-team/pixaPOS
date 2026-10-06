/**
 * Razorpay plan mapping for the real subscription tiers.
 *
 * Razorpay plan ids are created in the dashboard (Subscriptions → Plans) and
 * mapped per tier/cycle via env — never committed:
 *   RAZORPAY_PLAN_ID_STARTER / RAZORPAY_PLAN_ID_GROWTH
 *   RAZORPAY_PLAN_ID_STARTER_ANNUAL / RAZORPAY_PLAN_ID_GROWTH_ANNUAL
 *
 * Server-only (reads process.env). Never import from a client component.
 */

export type BillingTier = "starter" | "growth";
export type BillingCycle = "monthly" | "annual";

export const SELF_SERVE_TIERS: BillingTier[] = ["starter", "growth"];

export function isSelfServeTier(tier: string): tier is BillingTier {
  return (SELF_SERVE_TIERS as string[]).includes(tier);
}

/** Env var name for a tier/cycle (annual gets an _ANNUAL suffix). */
export function planEnvName(tier: string, cycle: BillingCycle): string {
  const base = `RAZORPAY_PLAN_ID_${tier.toUpperCase()}`;
  return cycle === "annual" ? `${base}_ANNUAL` : base;
}

/** Resolve the configured Razorpay plan id, or null when unset. */
export function razorpayPlanId(tier: string, cycle: BillingCycle): string | null {
  if (!isSelfServeTier(tier)) return null;
  return process.env[planEnvName(tier, cycle)] ?? null;
}

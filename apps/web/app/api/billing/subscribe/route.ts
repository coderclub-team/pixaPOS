import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { orgProfiles } from "@pixa/db";
import { createRazorpaySubscription, isRazorpayConfigured } from "@/features/billing/api/razorpay";
import { BILLING_PLAN } from "@/features/billing/api/types";
import {
  isSelfServeTier,
  planEnvName,
  razorpayPlanId,
  type BillingCycle,
} from "@/lib/billing-plans";

export const runtime = "nodejs";

/**
 * Create the Razorpay subscription for an organization upgrade.
 * Body: { organization_id, plan?, cycle?, start_at_unix? }.
 * The tier is resolved server-side (never trusted from the client): an explicit
 * `plan` is validated against the self-serve tiers, otherwise the organization's
 * catalog plan is used. Trial = future start_at (Razorpay treats the pre-start
 * window as the trial period — no charge until then).
 */
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Razorpay test keys not configured (Phase 2)" },
      { status: 503 },
    );
  }

  let body: {
    organization_id?: string;
    plan?: string;
    cycle?: string;
    start_at_unix?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.organization_id) {
    return NextResponse.json({ ok: false, error: "organization_id required" }, { status: 400 });
  }

  const cycle: BillingCycle = body.cycle === "annual" ? "annual" : "monthly";

  // Resolve the tier: explicit (validated) or the organization's catalog plan.
  let tier = body.plan?.toLowerCase();
  if (!tier) {
    try {
      const row = (
        await adminDb()
          .select({ plan: orgProfiles.plan })
          .from(orgProfiles)
          .where(eq(orgProfiles.organizationId, body.organization_id))
      )[0];
      tier = row?.plan ?? "starter";
    } catch {
      tier = "starter";
    }
  }

  if (!isSelfServeTier(tier)) {
    return NextResponse.json(
      { ok: false, error: "Custom plans are sales-assisted — contact the pixaPOS team." },
      { status: 400 },
    );
  }

  const planId = razorpayPlanId(tier, cycle);
  if (!planId) {
    return NextResponse.json(
      {
        ok: false,
        error: `Razorpay plan id for ${tier}${cycle === "annual" ? " annual" : ""} is not configured. Add ${planEnvName(
          tier,
          cycle,
        )} from the Razorpay dashboard (Subscriptions → Plans) before creating a subscription.`,
      },
      { status: 503 },
    );
  }

  try {
    const sub = await createRazorpaySubscription({
      plan_id: planId,
      start_at_unix:
        body.start_at_unix ?? Math.floor(Date.now() / 1000) + BILLING_PLAN.trial_days * 86400,
    });
    return NextResponse.json({
      ok: true,
      subscription_id: sub.id,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
      organization_id: body.organization_id,
      plan: tier,
      cycle,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "subscribe failed" },
      { status: 502 },
    );
  }
}

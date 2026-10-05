import { NextResponse } from "next/server";
import { createRazorpaySubscription, isRazorpayConfigured } from "@/features/billing/api/razorpay";
import { BILLING_PLAN } from "@/features/billing/api/types";

export const runtime = "nodejs";

/**
 * Create the Razorpay subscription for an organization upgrade.
 * Body: { organization_id, start_at_unix? }. Trial = future start_at (Razorpay
 * treats the pre-start window as the trial period — no charge until then).
 * Returns the subscription id + public key for Standard Checkout.
 */
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Razorpay test keys not configured (Phase 2)" },
      { status: 503 },
    );
  }

  let body: { organization_id?: string; start_at_unix?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.organization_id) {
    return NextResponse.json({ ok: false, error: "organization_id required" }, { status: 400 });
  }

  try {
    const sub = await createRazorpaySubscription({
      // Razorpay plan ids are created in the dashboard; Phase 2 maps
      // BILLING_PLAN.id → the dashboard plan id via env.
      plan_id: process.env.RAZORPAY_PLAN_ID ?? BILLING_PLAN.id,
      start_at_unix:
        body.start_at_unix ?? Math.floor(Date.now() / 1000) + BILLING_PLAN.trial_days * 86400,
    });
    return NextResponse.json({
      ok: true,
      subscription_id: sub.id,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
      organization_id: body.organization_id,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "subscribe failed" },
      { status: 502 },
    );
  }
}

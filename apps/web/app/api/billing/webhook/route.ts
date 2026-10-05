import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/features/billing/api/razorpay";
import { reconcileRazorpayInvoice } from "@/features/billing/api/service";

export const runtime = "nodejs";

/**
 * Razorpay webhook stub (Phase 2 completes it). Verifies the signature,
 * reconciles subscription invoices into the local ledger idempotently.
 * Configure RAZORPAY_WEBHOOK_SECRET + register this URL in the dashboard.
 *
 * NOTE: the billing service persists to localStorage on the client; on the
 * server it is instance memory only. Server-side persistence (DB) lands with
 * Phase 2 live wiring — until then this route validates + acknowledges.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 400 });
  }

  let event: { event?: string; payload?: any };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  // Phase 2: map subscription.charged / payment.captured payloads here.
  // Skeleton acknowledges receipt so Razorpay stops retrying unknown events.
  if (event.event === "subscription.charged" || event.event === "payment.captured") {
    const entity = event.payload?.payment?.entity ?? event.payload?.subscription?.entity ?? {};
    const organizationId = entity?.notes?.organization_id as string | undefined;
    if (organizationId && entity?.invoice_id) {
      await reconcileRazorpayInvoice(organizationId, {
        razorpay_invoice_id: String(entity.invoice_id),
        razorpay_payment_id: entity.id ? String(entity.id) : undefined,
        razorpay_subscription_id: entity.subscription_id
          ? String(entity.subscription_id)
          : undefined,
        status: "paid",
        // Razorpay amounts are already paise — no conversion.
        subtotal_paise: Math.round(Number(entity.amount ?? 0)),
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

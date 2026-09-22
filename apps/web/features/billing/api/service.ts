import { delay } from "@/constants/mock-api";
import { entityMutex } from "@/lib/mutex";
import {
  buildInvoiceTotals,
  deriveSubscriptionView,
  type BillingPlan,
  type Subscription,
  type SubscriptionInvoice,
  type SubscriptionView,
} from "./types";

const BILLING_STORAGE_KEY = "pixaBilling";

let mockSubscription: Subscription | null = null;
let mockInvoices: SubscriptionInvoice[] = [];

function saveBilling() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        BILLING_STORAGE_KEY,
        JSON.stringify({ subscription: mockSubscription, invoices: mockInvoices }),
      );
    } catch {}
  }
}

function loadBilling(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(BILLING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.subscription) mockSubscription = parsed.subscription;
        if (Array.isArray(parsed?.invoices)) mockInvoices = parsed.invoices;
      }
    } catch {}
  }
}
loadBilling();

/**
 * Fetch the outlet subscription with its derived status. Null until the
 * first ensure (billing page calls ensure on mount).
 */
export async function getSubscription(outletId: string): Promise<SubscriptionView | null> {
  await delay(300);
  loadBilling();
  if (!mockSubscription || mockSubscription.outlet_id !== outletId) return null;
  return deriveSubscriptionView(mockSubscription);
}

/**
 * Create the trial subscription if missing. Trial clock pins first-wins:
 * pass the Better Auth org `createdAt` when available, else local first-seen is stored.
 * NOTE (audit follow-up): subscription lifecycle events are not yet in the
 * business-event trail — Razorpay dashboard is the audit source short-term.
 */
export async function ensureSubscription(
  outletId: string,
  trialStartedAt?: string,
): Promise<SubscriptionView> {
  const release = await entityMutex.acquire("billing-write");
  try {
    await delay(400);
    loadBilling();
    if (mockSubscription && mockSubscription.outlet_id === outletId)
      return deriveSubscriptionView(mockSubscription);
    const now = new Date().toISOString();
    mockSubscription = {
      id: `sub_${Date.now().toString(36)}`,
      outlet_id: outletId,
      plan_id: "pixa_pro_monthly",
      trial_started_at: trialStartedAt ?? now,
      cancel_at_period_end: false,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    saveBilling();
    return deriveSubscriptionView(mockSubscription);
  } finally {
    release();
  }
}

/** Zoho pattern: usable until the paid period ends, then cancelled. */
export async function cancelSubscription(
  outletId: string,
  params: { atPeriodEnd?: boolean } = {},
): Promise<SubscriptionView> {
  const release = await entityMutex.acquire("billing-write");
  try {
    await delay(400);
    loadBilling();
    if (!mockSubscription || mockSubscription.outlet_id !== outletId) {
      throw new Error("No subscription found");
    }
    const now = new Date().toISOString();
    mockSubscription = {
      ...mockSubscription,
      cancel_at_period_end: params.atPeriodEnd ?? true,
      updated_at: now,
      version: mockSubscription.version + 1,
    };
    saveBilling();
    return deriveSubscriptionView(mockSubscription);
  } finally {
    release();
  }
}

export async function getInvoices(outletId: string): Promise<SubscriptionInvoice[]> {
  await delay(300);
  loadBilling();
  return [...mockInvoices]
    .filter((i) => i.outlet_id === outletId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Append an invoice to the local ledger (system of record for history). */
export async function recordInvoice(
  outletId: string,
  params: {
    subscription_id: string;
    period_start: string;
    period_end: string;
    subtotal_paise: number;
    status: SubscriptionInvoice["status"];
    razorpay_invoice_id?: string;
    razorpay_payment_id?: string;
  },
): Promise<SubscriptionInvoice> {
  const release = await entityMutex.acquire("billing-write");
  try {
    await delay(300);
    loadBilling();
    const totals = buildInvoiceTotals(params.subtotal_paise);
    const count = mockInvoices.filter((i) => i.outlet_id === outletId).length + 1;
    const year = new Date().getFullYear();
    const invoice: SubscriptionInvoice = {
      id: `binv_${Date.now().toString(36)}`,
      outlet_id: outletId,
      invoice_number: `INV-${year}-${String(count).padStart(4, "0")}`,
      created_at: new Date().toISOString(),
      gst_percent: totals.gst_percent,
      gst_paise: totals.gst_paise,
      total_paise: totals.total_paise,
      ...params,
    };
    mockInvoices.push(invoice);
    saveBilling();
    return { ...invoice };
  } finally {
    release();
  }
}

/**
 * Webhook reconciliation (Phase 2 caller): upsert by Razorpay invoice id so
 * retried deliveries stay idempotent; attach subscription refs on success.
 */
export async function reconcileRazorpayInvoice(
  outletId: string,
  params: {
    razorpay_invoice_id: string;
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    status: SubscriptionInvoice["status"];
    subtotal_paise: number;
    period_start: string;
    period_end: string;
  },
): Promise<SubscriptionInvoice> {
  const release = await entityMutex.acquire("billing-write");
  try {
    loadBilling();
    const existing = mockInvoices.find(
      (i) => i.outlet_id === outletId && i.razorpay_invoice_id === params.razorpay_invoice_id,
    );
    if (existing) {
      const totals = buildInvoiceTotals(params.subtotal_paise);
      const idx = mockInvoices.indexOf(existing);
      mockInvoices[idx] = {
        ...existing,
        ...params,
        gst_percent: totals.gst_percent,
        gst_paise: totals.gst_paise,
        total_paise: totals.total_paise,
      };
      if (params.status === "paid" && mockSubscription?.outlet_id === outletId) {
        mockSubscription = {
          ...mockSubscription,
          razorpay_subscription_id:
            params.razorpay_subscription_id ?? mockSubscription.razorpay_subscription_id,
          current_period_start: params.period_start,
          current_period_end: params.period_end,
          last_payment_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: mockSubscription.version + 1,
        };
      }
      saveBilling();
      return { ...mockInvoices[idx] };
    }
    // New invoice — reuse recordInvoice path without re-locking.
    const totals = buildInvoiceTotals(params.subtotal_paise);
    const count = mockInvoices.filter((i) => i.outlet_id === outletId).length + 1;
    const invoice: SubscriptionInvoice = {
      id: `binv_${Date.now().toString(36)}`,
      outlet_id: outletId,
      subscription_id: mockSubscription?.id ?? "unknown",
      invoice_number: `INV-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
      period_start: params.period_start,
      period_end: params.period_end,
      subtotal_paise: params.subtotal_paise,
      gst_percent: totals.gst_percent,
      gst_paise: totals.gst_paise,
      total_paise: totals.total_paise,
      status: params.status,
      razorpay_invoice_id: params.razorpay_invoice_id,
      razorpay_payment_id: params.razorpay_payment_id,
      created_at: new Date().toISOString(),
    };
    mockInvoices.push(invoice);
    if (params.status === "paid" && mockSubscription?.outlet_id === outletId) {
      mockSubscription = {
        ...mockSubscription,
        razorpay_subscription_id:
          params.razorpay_subscription_id ?? mockSubscription.razorpay_subscription_id,
        current_period_start: params.period_start,
        current_period_end: params.period_end,
        last_payment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: mockSubscription.version + 1,
      };
    }
    saveBilling();
    return { ...invoice };
  } finally {
    release();
  }
}

export type { BillingPlan, SubscriptionView };

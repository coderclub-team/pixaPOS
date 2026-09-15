import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import { getOrderById } from "@/features/orders/api/service";
import type { Payment, PaymentFilters, PaymentMethod, Refund } from "./types";

const PAYMENT_STORAGE_KEY = "pixaPayments";

let mockPayments: Payment[] = [];
let mockRefunds: Refund[] = [];

function savePayments() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        PAYMENT_STORAGE_KEY,
        JSON.stringify({ payments: mockPayments, refunds: mockRefunds }),
      );
    } catch {}
  }
}

function loadPayments(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(PAYMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.payments)) mockPayments = parsed.payments;
        if (Array.isArray(parsed?.refunds)) mockRefunds = parsed.refunds;
      }
    } catch {}
  }
}
loadPayments();

export async function getPayments(filters?: PaymentFilters): Promise<Payment[]> {
  await delay(200);
  loadPayments(); // localStorage is the shared source — reload so tabs/displays agree
  let r = [...mockPayments];
  if (filters?.outlet_id) r = r.filter((p) => p.outlet_id === filters.outlet_id);
  if (filters?.order_id) r = r.filter((p) => p.order_id === filters.order_id);
  if (filters?.method) r = r.filter((p) => p.method === filters.method);
  if (filters?.status) r = r.filter((p) => p.status === filters.status);
  return r.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getRefundsByOrder(orderId: string): Promise<Refund[]> {
  await delay(200);
  loadPayments();
  return mockRefunds.filter((r) => r.order_id === orderId);
}

/**
 * In-memory reads WITHOUT reload — for use inside mutations that already
 * hold fresh state (a reload before save would revert the in-flight
 * payment/refund and persist the revert).
 */
export function peekPayments(): Payment[] {
  return [...mockPayments];
}

export function peekRefunds(): Refund[] {
  return [...mockRefunds];
}

/**
 * Collect a payment against an order's balance. Non-cash methods must match
 * the balance exactly; cash may over-tender with change due. Each payment is
 * an immutable record — post-paid edits add balance, never rewrite history.
 */
export async function collectPayment(params: {
  order_id: string;
  method: PaymentMethod;
  amount_paise: number;
  tendered_paise?: number;
  partition_label?: string;
  received_by?: string;
}): Promise<Payment> {
  const release = await entityMutex.acquire(`pay-order-${params.order_id}`);
  try {
    await delay(400);
    loadPayments(); // re-read under lock so a concurrent tab's write isn't clobbered
    const { getOrderWithBilling } = await import("@/features/orders/api/service");
    const billing = await getOrderWithBilling(params.order_id);
    if (!billing) throw new Error("Order not found");
    if (!Number.isInteger(params.amount_paise) || params.amount_paise < 1) {
      throw new Error("Amount must be a positive paise integer");
    }
    if (params.amount_paise > billing.balance_paise) {
      throw new Error(`Amount exceeds the balance of ${billing.balance_paise} paise`);
    }

    let change = 0;
    if (params.method === "cash" && params.tendered_paise !== undefined) {
      if (!Number.isInteger(params.tendered_paise) || params.tendered_paise < params.amount_paise) {
        throw new Error("Tendered cash must cover the amount");
      }
      change = params.tendered_paise - params.amount_paise;
    } else if (params.tendered_paise !== undefined) {
      throw new Error("Tendered/change applies to cash only");
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: `pay_${Date.now().toString(36)}`,
      outlet_id: billing.order.outlet_id,
      order_id: params.order_id,
      method: params.method,
      amount_paise: params.amount_paise,
      tendered_paise: params.tendered_paise,
      change_paise: change || undefined,
      partition_label: params.partition_label?.trim() || undefined,
      status: "PAID",
      received_by: params.received_by ?? "staff",
      created_at: now,
      updated_at: now,
    };
    mockPayments.push(payment);
    savePayments();

    const { refreshOrderPaymentState } = await import("@/features/orders/api/service");
    await refreshOrderPaymentState(params.order_id);

    await recordEvent({
      outlet_id: payment.outlet_id,
      entity_type: "PAYMENT",
      entity_id: payment.id,
      event_type: "PAYMENT_COMPLETED",
      actor_id: payment.received_by,
      metadata: {
        order_id: params.order_id,
        method: params.method,
        amount_paise: params.amount_paise,
        change_paise: change || undefined,
        partition_label: payment.partition_label,
      },
    });
    return { ...payment };
  } finally {
    release();
  }
}

/** Record-only refund against a paid payment. Does not mutate the payment. */
export async function recordRefund(params: {
  payment_id: string;
  amount_paise: number;
  reason: string;
  by?: string;
  /** Item linkage for item-wise returns. */
  order_line_id?: string;
  qty?: number;
  return_id?: string;
  /**
   * Gateway handoff (phase 2): when the payment carries a gateway_payment_id,
   * the refund is created REFUND_PENDING (visible, never silent) until the
   * Razorpay refund API + webhook reconcile it. Cash/manual refunds settle
   * instantly as REFUNDED.
   */
  gateway_payment_id?: string;
}): Promise<Refund> {
  loadPayments(); // shared source may have moved in another tab
  const payment = mockPayments.find((p) => p.id === params.payment_id);
  if (!payment) throw new Error("Payment not found");
  const release = await entityMutex.acquire(`pay-${params.payment_id}`);
  try {
    await delay(300);
    if (payment.status !== "PAID") throw new Error("Only paid payments can be refunded");
    if (!params.reason?.trim()) throw new Error("A reason is required for a refund");
    const reserved = mockRefunds
      .filter((r) => r.payment_id === payment.id && r.status !== "REFUND_FAILED")
      .reduce((s, r) => s + r.amount_paise, 0);
    if (!Number.isInteger(params.amount_paise) || params.amount_paise < 1) {
      throw new Error("Refund amount must be a positive paise integer");
    }
    if (reserved + params.amount_paise > payment.amount_paise) {
      throw new Error("Refund exceeds the payment amount");
    }
    const gatewayId = params.gateway_payment_id ?? payment.gateway_payment_id;
    const now = new Date().toISOString();
    const refund: Refund = {
      id: `ref_${Date.now().toString(36)}`,
      payment_id: payment.id,
      order_id: payment.order_id,
      outlet_id: payment.outlet_id,
      amount_paise: params.amount_paise,
      reason: params.reason.trim(),
      status: gatewayId ? "REFUND_PENDING" : "REFUNDED",
      created_by: params.by ?? "staff",
      created_at: now,
      order_line_id: params.order_line_id,
      qty: params.qty,
      return_id: params.return_id,
      gateway_payment_id: gatewayId,
      gateway_status: gatewayId ? "PENDING" : undefined,
    };
    mockRefunds.push(refund);
    savePayments();

    const { refreshOrderPaymentState } = await import("@/features/orders/api/service");
    await refreshOrderPaymentState(payment.order_id);

    await recordEvent({
      outlet_id: payment.outlet_id,
      entity_type: "PAYMENT",
      entity_id: payment.id,
      event_type: "REFUND_CREATED",
      actor_id: refund.created_by,
      reason_text: refund.reason,
      metadata: {
        order_id: payment.order_id,
        amount_paise: refund.amount_paise,
        return_id: refund.return_id,
        gateway_status: refund.gateway_status,
      },
    });
    return { ...refund };
  } finally {
    release();
  }
}

/** Preview of a return's refund split across the order's paid methods. */
export type RefundAllocation = {
  payment_id: string;
  method: Payment["method"];
  amount_paise: number;
  pending_gateway: boolean;
};

export async function previewReturnAllocation(
  orderId: string,
  total_paise: number,
): Promise<{ allocations: RefundAllocation[]; shortfall_paise: number }> {
  const payments = (await getPayments({ order_id: orderId, status: "PAID" })).sort(
    (a, b) => b.amount_paise - a.amount_paise,
  );
  const refunds = await getRefundsByOrder(orderId);
  const reserved = (pid: string) =>
    refunds
      .filter((r) => r.payment_id === pid && r.status !== "REFUND_FAILED")
      .reduce((s, r) => s + r.amount_paise, 0);
  let remaining = total_paise;
  const allocations: RefundAllocation[] = [];
  for (const p of payments) {
    if (remaining <= 0) break;
    const headroom = p.amount_paise - reserved(p.id);
    if (headroom <= 0) continue;
    const take = Math.min(headroom, remaining);
    allocations.push({
      payment_id: p.id,
      method: p.method,
      amount_paise: take,
      pending_gateway: !!p.gateway_payment_id,
    });
    remaining -= take;
  }
  return { allocations, shortfall_paise: remaining };
}

/**
 * Same-method refund for an item-wise return. Splits the return total across
 * the order's paid payments (largest-first), each capped by its unrefunded
 * remainder. Cash/manual settle instantly; gateway-sourced payments land as
 * REFUND_PENDING until the Razorpay phase reconciles them.
 */
export async function refundForReturn(
  orderId: string,
  params: { return_id: string; total_paise: number; reason: string; by?: string },
): Promise<Refund[]> {
  if (!Number.isInteger(params.total_paise) || params.total_paise < 1) {
    throw new Error("Return total must be a positive paise integer");
  }
  const { allocations, shortfall_paise } = await previewReturnAllocation(
    orderId,
    params.total_paise,
  );
  if (shortfall_paise > 0) {
    throw new Error("Return exceeds refundable payments — collect history is short");
  }
  const created: Refund[] = [];
  for (const a of allocations) {
    created.push(
      await recordRefund({
        payment_id: a.payment_id,
        amount_paise: a.amount_paise,
        reason: params.reason,
        by: params.by,
        return_id: params.return_id,
      }),
    );
  }
  return created;
}

export async function paidTotalForOrder(orderId: string): Promise<number> {
  const payments = await getPayments({ order_id: orderId, status: "PAID" });
  const refunds = await getRefundsByOrder(orderId);
  const refunded = refunds
    .filter((r) => r.status === "REFUNDED")
    .reduce((s, r) => s + r.amount_paise, 0);
  return payments.reduce((s, p) => s + p.amount_paise, 0) - refunded;
}

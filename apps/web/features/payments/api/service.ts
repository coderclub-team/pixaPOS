/**
 * Payments domain — client service (server-backed).
 *
 * Thin fetch layer over /api/payments + /api/orders/:id/pay. Row reads go
 * straight at the payments ledger; billing math (paid/balance/partition
 * guards) is derived client-side from the same rows or via the billing
 * endpoint. No local persistence.
 */
import { getServiceOutletId } from "@/features/outlet/api/outlets";
import type {
  Payment,
  PaymentFilters,
  PaymentMethod,
  Refund,
  RefundFilters,
  RefundWithMethod,
} from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getPayments(filters?: PaymentFilters): Promise<Payment[]> {
  const { rows } = await api<{ rows: Payment[] }>(
    `/api/payments${toQuery({
      outlet_id: filters?.outlet_id ?? getServiceOutletId() ?? undefined,
      order_id: filters?.order_id,
      method: filters?.method,
      status: filters?.status,
    })}`,
  );
  return rows ?? [];
}

export async function getRefundsByOrder(orderId: string): Promise<Refund[]> {
  const { rows } = await api<{ rows: Refund[] }>(
    `/api/payments${toQuery({ kind: "refund", order_id: orderId })}`,
  );
  return rows ?? [];
}

export async function getRefunds(filters?: RefundFilters): Promise<RefundWithMethod[]> {
  const { rows } = await api<{ rows: Refund[] }>(
    `/api/payments${toQuery({
      kind: "refund",
      outlet_id: filters?.outlet_id ?? getServiceOutletId() ?? undefined,
      status: filters?.status,
      search: filters?.search,
    })}`,
  );
  return (rows ?? []) as RefundWithMethod[];
}

export async function collectPayment(params: {
  order_id: string;
  method: PaymentMethod;
  amount_paise: number;
  tendered_paise?: number;
  partition_label?: string;
  received_by?: string;
}): Promise<Payment> {
  const { payment } = await api<{ ok: boolean; payment: Payment }>(
    `/api/orders/${encodeURIComponent(params.order_id)}/pay`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: params.method,
        amount_paise: params.amount_paise,
        tendered_paise: params.tendered_paise,
        partition_label: params.partition_label,
        received_by: params.received_by,
      }),
    },
  );
  return payment;
}

/** Net paid on an order: PAID rows minus REFUNDED rows (client-side math). */
export async function paidTotalForOrder(orderId: string): Promise<number> {
  const [payments, refunds] = await Promise.all([
    getPayments({ order_id: orderId, status: "PAID" }),
    getRefundsByOrder(orderId),
  ]);
  const paid = payments.reduce((s, p) => s + p.amount_paise, 0);
  const refunded = refunds
    .filter((r) => r.status === "REFUNDED")
    .reduce((s, r) => s + r.amount_paise, 0);
  return paid - refunded;
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
  const [payments, refunds] = await Promise.all([
    getPayments({ order_id: orderId, status: "PAID" }),
    getRefundsByOrder(orderId),
  ]);
  const reserved = (pid: string) =>
    refunds
      .filter((r) => r.payment_id === pid && r.status !== "REFUND_FAILED")
      .reduce((s, r) => s + r.amount_paise, 0);
  let remaining = total_paise;
  const allocations: RefundAllocation[] = [];
  for (const p of [...payments].sort((a, b) => b.amount_paise - a.amount_paise)) {
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

/** Item-wise refund allocation (server executes via returns route). */
export async function refundForReturn(
  orderId: string,
  params: { return_id: string; total_paise: number; reason: string; by?: string },
): Promise<Refund[]> {
  throw new Error(
    `refundForReturn is server-executed via POST /api/orders/${orderId}/returns — pass line qtys instead (return_id ${params.return_id})`,
  );
}

/** Record-only refund (server-executed inside returns; no direct client use). */
export async function recordRefund(): Promise<never> {
  throw new Error("Refunds are server-executed inside the returns flow — no direct client call");
}

/**
 * Payments domain — server implementation (Postgres via Drizzle).
 *
 * Row-level CRUD only. All orchestration (billing math, order state
 * transitions) lives in the orders service, which calls these primitives —
 * keeping the dependency one-way (orders → payments) and this module
 * import-free of other domains.
 *
 * Server-only: import from API routes, never from client components.
 */
import { and, eq } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import { db, payments, refunds } from "@pixa/db";
import type { Payment, PaymentFilters, Refund, RefundFilters } from "./types";

export type ServerPaymentRow = typeof payments.$inferSelect;
export type ServerRefundRow = typeof refunds.$inferSelect;

export function toClientPayment(p: ServerPaymentRow): Payment {
  return {
    id: p.id,
    outlet_id: p.outletId ?? "",
    order_id: p.orderId,
    method: p.method as Payment["method"],
    amount_paise: p.amountPaise,
    tendered_paise: p.tenderedPaise ?? undefined,
    change_paise: p.changePaise ?? undefined,
    partition_label: p.partitionLabel ?? undefined,
    status: p.status as Payment["status"],
    received_by: p.receivedBy ?? undefined,
    gateway_payment_id: undefined,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
  };
}

export function toClientRefund(r: ServerRefundRow): Refund {
  return {
    id: r.id,
    payment_id: r.paymentId ?? "",
    order_id: r.orderId,
    outlet_id: r.outletId ?? "",
    amount_paise: r.amountPaise,
    reason: r.reason,
    status: r.status as Refund["status"],
    created_by: r.createdBy ?? undefined,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    order_line_id: (r as Record<string, unknown>).orderLineId as string | undefined,
    qty: (r as Record<string, unknown>).qty as number | undefined,
    return_id: (r as Record<string, unknown>).returnId as string | undefined,
    gateway_payment_id: undefined,
    gateway_refund_id: undefined,
    gateway_status: undefined,
  };
}

export async function listPayments(
  organizationId: string,
  filters?: PaymentFilters & { outlet_id?: string | null; order_id?: string },
): Promise<Payment[]> {
  const conds = [eq(payments.organizationId, organizationId)];
  if (filters?.outlet_id) conds.push(eq(payments.outletId, filters.outlet_id));
  if (filters?.order_id) conds.push(eq(payments.orderId, filters.order_id));
  if (filters?.method) conds.push(eq(payments.method, filters.method));
  if (filters?.status) conds.push(eq(payments.status, filters.status));
  const rows = await db()
    .select()
    .from(payments)
    .where(and(...conds))
    .orderBy(payments.createdAt);
  return rows.map(toClientPayment);
}

export async function insertPayment(input: {
  organizationId: string;
  outletId: string;
  orderId: string;
  method: string;
  amountPaise: number;
  tenderedPaise?: number;
  changePaise?: number;
  partitionLabel?: string;
  receivedBy?: string;
  status?: string;
}): Promise<Record<string, unknown>> {
  const [row] = await db()
    .insert(payments)
    .values({
      id: ulid(),
      organizationId: input.organizationId,
      outletId: input.outletId,
      orderId: input.orderId,
      method: input.method,
      amountPaise: input.amountPaise,
      tenderedPaise: input.tenderedPaise ?? null,
      changePaise: input.changePaise ?? 0,
      status: input.status ?? "PAID",
      partitionLabel: input.partitionLabel ?? null,
      receivedBy: input.receivedBy ?? null,
    })
    .returning();
  return row as unknown as Record<string, unknown>;
}

export async function paidTotalForOrder(organizationId: string, orderId: string): Promise<number> {
  const [paid, refunded] = await Promise.all([
    db()
      .select({ status: payments.status, amountPaise: payments.amountPaise })
      .from(payments)
      .where(and(eq(payments.organizationId, organizationId), eq(payments.orderId, orderId))),
    db()
      .select({ status: refunds.status, amountPaise: refunds.amountPaise })
      .from(refunds)
      .where(and(eq(refunds.organizationId, organizationId), eq(refunds.orderId, orderId))),
  ]);
  const paidSum = paid
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + (p.amountPaise ?? 0), 0);
  const refundedSum = (refunded as { status: string | null; amountPaise: number | null }[])
    .filter((r) => r.status === "REFUNDED")
    .reduce((s, r) => s + (r.amountPaise ?? 0), 0);
  return paidSum - refundedSum;
}

export async function listRefunds(
  organizationId: string,
  filters?: RefundFilters & { outlet_id?: string | null; order_id?: string },
): Promise<Refund[]> {
  const conds = [eq(refunds.organizationId, organizationId)];
  if (filters?.outlet_id) conds.push(eq(refunds.outletId, filters.outlet_id));
  if (filters?.order_id) conds.push(eq(refunds.orderId, filters.order_id));
  if (filters?.status) conds.push(eq(refunds.status, filters.status as string));
  let rows = await db()
    .select()
    .from(refunds)
    .where(and(...conds))
    .orderBy(refunds.createdAt);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = (rows as unknown as Record<string, unknown>[]).filter((r) => {
      const id = String(r.id ?? "").toLowerCase();
      const oid = String(r.orderId ?? "").toLowerCase();
      const reason = String((r as Record<string, unknown>).reason ?? "").toLowerCase();
      return id.includes(q) || oid.includes(q) || reason.includes(q);
    }) as unknown as typeof rows;
  }
  return (rows as unknown as Record<string, unknown>[]).map(toClientRefund as never) as Refund[];
}

export async function recordRefund(input: {
  organizationId: string;
  outletId: string;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  reason: string;
  status?: string;
  createdBy?: string;
  orderLineId?: string;
  qty?: number;
  returnId?: string;
}): Promise<Record<string, unknown>> {
  const [row] = await db()
    .insert(refunds)
    .values({
      id: ulid(),
      organizationId: input.organizationId,
      outletId: input.outletId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      amountPaise: input.amountPaise,
      reason: input.reason,
      status: input.status ?? "REFUNDED",
      createdBy: input.createdBy ?? null,
      orderLineId: input.orderLineId ?? null,
      qty: input.qty ?? null,
      returnId: input.returnId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return row as unknown as Record<string, unknown>;
}

export async function reservedForPayment(
  organizationId: string,
  paymentId: string,
): Promise<number> {
  const rows = await db()
    .select({ amountPaise: refunds.amountPaise, status: refunds.status })
    .from(refunds)
    .where(and(eq(refunds.organizationId, organizationId), eq(refunds.paymentId, paymentId)));
  return rows
    .filter((r) => r.status !== "REFUND_FAILED")
    .reduce((s, r) => s + (r.amountPaise ?? 0), 0);
}

export async function reservedForOrder(
  organizationId: string,
  orderId: string,
): Promise<Map<string, number>> {
  const rows = await db()
    .select({
      paymentId: refunds.paymentId,
      amountPaise: refunds.amountPaise,
      status: refunds.status,
    })
    .from(refunds)
    .where(and(eq(refunds.organizationId, organizationId), eq(refunds.orderId, orderId)));
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "REFUND_FAILED" || !r.paymentId) continue;
    map.set(r.paymentId, (map.get(r.paymentId) ?? 0) + (r.amountPaise ?? 0));
  }
  return map;
}

export async function getPaymentsWithMethods(
  organizationId: string,
  orderId: string,
): Promise<{ method: string | null; amount_paise: number; status: string; id: string }[]> {
  const rows = await db()
    .select({
      id: payments.id,
      method: payments.method,
      amountPaise: payments.amountPaise,
      status: payments.status,
    })
    .from(payments)
    .where(and(eq(payments.organizationId, organizationId), eq(payments.orderId, orderId)))
    .orderBy(payments.createdAt);
  return rows.map((r) => ({
    id: r.id as string,
    method: r.method as string | null,
    amount_paise: (r.amountPaise as number | null) ?? 0,
    status: String(r.status),
  }));
}

export async function refundedTotalForOrder(
  organizationId: string,
  orderId: string,
): Promise<number> {
  const rows = await db()
    .select({ amountPaise: refunds.amountPaise, status: refunds.status })
    .from(refunds)
    .where(and(eq(refunds.organizationId, organizationId), eq(refunds.orderId, orderId)));
  return rows.filter((r) => r.status === "REFUNDED").reduce((s, r) => s + (r.amountPaise ?? 0), 0);
}

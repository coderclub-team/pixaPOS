import { queryOptions } from "@tanstack/react-query";
import { getPayments, getRefundsByOrder } from "./service";
import type { PaymentFilters } from "./types";

export const paymentKeys = {
  all: ["payments"] as const,
  list: (filters?: PaymentFilters) => [...paymentKeys.all, "list", filters ?? {}] as const,
  byOrder: (orderId: string) => [...paymentKeys.all, "by-order", orderId] as const,
  refundsByOrder: (orderId: string) => [...paymentKeys.all, "refunds", orderId] as const,
};

export const paymentsQueryOptions = (filters?: PaymentFilters) =>
  queryOptions({ queryKey: paymentKeys.list(filters), queryFn: () => getPayments(filters) });

export const paymentsByOrderQueryOptions = (orderId: string) =>
  queryOptions({ queryKey: paymentKeys.byOrder(orderId), queryFn: () => getPayments({ order_id: orderId }) });

export const refundsByOrderQueryOptions = (orderId: string) =>
  queryOptions({ queryKey: paymentKeys.refundsByOrder(orderId), queryFn: () => getRefundsByOrder(orderId) });

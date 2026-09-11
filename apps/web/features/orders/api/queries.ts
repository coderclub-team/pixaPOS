import { queryOptions } from "@tanstack/react-query";
import { getOrderById, getOrders } from "./service";
import type { OrderFilters } from "./types";

export const orderKeys = {
  all: ["orders"] as const,
  list: (filters?: OrderFilters) => [...orderKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

export const ordersQueryOptions = (filters?: OrderFilters) =>
  queryOptions({ queryKey: orderKeys.list(filters), queryFn: () => getOrders(filters) });

export const orderQueryOptions = (id: string) =>
  queryOptions({ queryKey: orderKeys.detail(id), queryFn: () => getOrderById(id) });

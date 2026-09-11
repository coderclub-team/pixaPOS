import { queryOptions } from "@tanstack/react-query";
import { getCustomerById, getCustomers } from "./service";
import type { CustomerFilters } from "./types";

export const customerKeys = {
  all: ["customers"] as const,
  list: (filters?: CustomerFilters) => [...customerKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};

export const customersQueryOptions = (filters?: CustomerFilters) =>
  queryOptions({ queryKey: customerKeys.list(filters), queryFn: () => getCustomers(filters) });

export const customerQueryOptions = (id: string) =>
  queryOptions({ queryKey: customerKeys.detail(id), queryFn: () => getCustomerById(id) });

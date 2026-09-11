import { queryOptions } from "@tanstack/react-query";
import { getKitchenTickets, getKOTsByOrder, getTicketById } from "./service";
import type { KOTFilters } from "./types";

export const kitchenKeys = {
  all: ["kitchen"] as const,
  list: (filters?: KOTFilters) => [...kitchenKeys.all, "tickets", filters ?? {}] as const,
  detail: (id: string) => [...kitchenKeys.all, "ticket", id] as const,
  byOrder: (orderId: string) => [...kitchenKeys.all, "by-order", orderId] as const,
};

export const kitchenTicketsQueryOptions = (filters?: KOTFilters) =>
  queryOptions({ queryKey: kitchenKeys.list(filters), queryFn: () => getKitchenTickets(filters) });

export const ticketQueryOptions = (id: string) =>
  queryOptions({ queryKey: kitchenKeys.detail(id), queryFn: () => getTicketById(id) });

export const kotsByOrderQueryOptions = (orderId: string) =>
  queryOptions({ queryKey: kitchenKeys.byOrder(orderId), queryFn: () => getKOTsByOrder(orderId) });

import { queryOptions } from "@tanstack/react-query";
import { getEvents } from "./service";
import type { EventFilters } from "./types";

export const eventKeys = {
  all: ["events"] as const,
  list: (filters?: EventFilters) => [...eventKeys.all, "list", filters ?? {}] as const,
  byOrder: (orderId: string) =>
    [...eventKeys.all, "by-order", orderId] as const,
};

export const eventsQueryOptions = (filters?: EventFilters) =>
  queryOptions({ queryKey: eventKeys.list(filters), queryFn: () => getEvents(filters) });

/**
 * Order audit trail: ORDER-scoped events for this order. Money lives in
 * PAYMENT scope — the timeline merges both (see order-timeline).
 */
export const orderEventsQueryOptions = (orderId: string) =>
  queryOptions({
    queryKey: eventKeys.byOrder(orderId),
    queryFn: () => getEvents({ entity_type: "ORDER", entity_id: orderId }),
  });

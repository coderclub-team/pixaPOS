import { queryOptions } from "@tanstack/react-query";
import { getPromoById, getPromos, promoUsage } from "./service";

export const promoKeys = {
  all: ["promos"] as const,
  detail: (id: string) => [...promoKeys.all, "detail", id] as const,
  usage: (id: string) => [...promoKeys.all, "usage", id] as const,
};

export const promosQueryOptions = () =>
  queryOptions({ queryKey: promoKeys.all, queryFn: getPromos });

export const promoQueryOptions = (id: string) =>
  queryOptions({ queryKey: promoKeys.detail(id), queryFn: () => getPromoById(id) });

export const promoUsageQueryOptions = (id: string) =>
  queryOptions({ queryKey: promoKeys.usage(id), queryFn: () => promoUsage(id) });

import { queryOptions } from "@tanstack/react-query";
import { getInvoices, getSubscription } from "./service";

export const billingKeys = {
  all: ["billing"] as const,
  subscription: (outletId: string) => [...billingKeys.all, "subscription", outletId] as const,
  invoices: (outletId: string) => [...billingKeys.all, "invoices", outletId] as const,
};

export const subscriptionQueryOptions = (outletId: string) =>
  queryOptions({
    queryKey: billingKeys.subscription(outletId),
    queryFn: () => getSubscription(outletId),
  });

export const invoicesQueryOptions = (outletId: string) =>
  queryOptions({
    queryKey: billingKeys.invoices(outletId),
    queryFn: () => getInvoices(outletId),
  });

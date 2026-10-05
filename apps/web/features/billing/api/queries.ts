import { queryOptions } from "@tanstack/react-query";
import { getInvoices, getSubscription } from "./service";

export const billingKeys = {
  all: ["billing"] as const,
  subscription: (organizationId: string) =>
    [...billingKeys.all, "subscription", organizationId] as const,
  invoices: (organizationId: string) => [...billingKeys.all, "invoices", organizationId] as const,
};

export const subscriptionQueryOptions = (organizationId: string) =>
  queryOptions({
    queryKey: billingKeys.subscription(organizationId),
    queryFn: () => getSubscription(organizationId),
  });

export const invoicesQueryOptions = (organizationId: string) =>
  queryOptions({
    queryKey: billingKeys.invoices(organizationId),
    queryFn: () => getInvoices(organizationId),
  });

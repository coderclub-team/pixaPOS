"use client";

import PageContainer from "@/components/layout/page-container";
import OrderSettingsForm from "@/features/outlet/components/order-settings-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function OrderSettingsPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Order Settings" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Order Settings" pageDescription="Outlet — Operations order settings">
      <OrderSettingsForm
        initialData={{
          ask_customer_details: outlet.ask_customer_details ?? false,
          allow_off_hours_orders: outlet.allow_off_hours_orders ?? false,
          require_off_hours_reason: outlet.require_off_hours_reason ?? true,
        }}
      />
    </PageContainer>
  );
}

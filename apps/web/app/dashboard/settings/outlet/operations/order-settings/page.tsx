"use client";

import PageContainer from "@pixa/ui/layout/page-container";
import OrderSettingsForm from "@/features/outlet/components/order-settings-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function OrderSettingsPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Order Settings" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Order Settings">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Order Settings" pageDescription="Outlet — Operations order settings">
      <OrderSettingsForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          ask_customer_details: outlet.ask_customer_details ?? false,
          allow_off_hours_orders: outlet.allow_off_hours_orders ?? false,
          require_off_hours_reason: outlet.require_off_hours_reason ?? true,
        }}
      />
    </PageContainer>
  );
}

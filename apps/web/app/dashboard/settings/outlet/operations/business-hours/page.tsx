"use client";

import PageContainer from "@pixa/ui/layout/page-container";
import BusinessHoursForm from "@/features/outlet/components/business-hours-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { defaultBusinessHours } from "@/features/outlet/api/service";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function BusinessHoursPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Business Hours" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Business Hours">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Business Hours"
      pageDescription="Outlet — Operations hours, per channel"
    >
      <BusinessHoursForm
        outletId={activeOutletId ?? outlet.id}
        initialData={outlet.business_hours ?? defaultBusinessHours()}
      />
    </PageContainer>
  );
}

"use client";

import PageContainer from "@/components/layout/page-container";
import TimezoneForm from "@/features/outlet/components/timezone-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function TimezonePage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Timezone" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Timezone">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Timezone" pageDescription="Outlet — Operations timezone">
      <TimezoneForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          currency: outlet.currency,
          timezone: outlet.timezone,
          locale: outlet.locale,
          is_active: outlet.is_active,
        }}
      />
    </PageContainer>
  );
}

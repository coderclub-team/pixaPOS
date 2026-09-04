"use client";

import PageContainer from "@/components/layout/page-container";
import TimezoneForm from "@/features/outlet/components/timezone-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function TimezonePage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Timezone" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Timezone" pageDescription="Outlet — Operations timezone">
      <TimezoneForm
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

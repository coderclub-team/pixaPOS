"use client";

import PageContainer from "@/components/layout/page-container";
import BusinessHoursForm from "@/features/outlet/components/business-hours-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { defaultBusinessHours } from "@/features/outlet/api/service";
import { useQuery } from "@tanstack/react-query";

export default function BusinessHoursPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Business Hours" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Business Hours"
      pageDescription="Outlet — Operations hours, per channel"
    >
      <BusinessHoursForm initialData={outlet.business_hours ?? defaultBusinessHours()} />
    </PageContainer>
  );
}

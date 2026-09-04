"use client";

import PageContainer from "@/components/layout/page-container";
import BusinessDetailsForm from "@/features/outlet/components/business-details-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function BusinessDetailsPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Business Details" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Business Details"
      pageDescription="Outlet — Legal & Tax business details"
    >
      <BusinessDetailsForm
        initialData={{
          legal_name: outlet.legal_name ?? "",
          pan: outlet.pan ?? "",
          gstin: outlet.gstin ?? "",
          fssai_number: outlet.fssai_number ?? "",
        }}
      />
    </PageContainer>
  );
}

"use client";

import PageContainer from "@/components/layout/page-container";
import BusinessDetailsForm from "@/features/outlet/components/business-details-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function BusinessDetailsPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Business Details" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Business Details">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Business Details"
      pageDescription="Outlet — Legal & Tax business details"
    >
      <BusinessDetailsForm
        outletId={activeOutletId ?? outlet.id}
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

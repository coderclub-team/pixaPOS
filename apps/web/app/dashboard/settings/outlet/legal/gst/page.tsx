"use client";

import PageContainer from "@/components/layout/page-container";
import GSTForm from "@/features/outlet/components/gst-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function GSTPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="GST" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="GST">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="GST" pageDescription="Outlet — Legal & Tax GST">
      <GSTForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          gst_registered: outlet.gst_registered,
          gstin: outlet.gstin ?? "",
          legal_name: outlet.legal_name ?? "",
          pan: outlet.pan ?? "",
        }}
      />
    </PageContainer>
  );
}

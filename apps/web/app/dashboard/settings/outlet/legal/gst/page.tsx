"use client";

import PageContainer from "@/components/layout/page-container";
import GSTForm from "@/features/outlet/components/gst-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function GSTPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="GST" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="GST" pageDescription="Outlet — Legal & Tax GST">
      <GSTForm
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

"use client";

import PageContainer from "@/components/layout/page-container";
import FSSAIForm from "@/features/outlet/components/fssai-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function FSSAIPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="FSSAI" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="FSSAI" pageDescription="Outlet — FSSAI">
      <FSSAIForm initialData={{ fssai_number: outlet.fssai_number ?? "" }} />
    </PageContainer>
  );
}

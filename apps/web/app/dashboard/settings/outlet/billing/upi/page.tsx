"use client";

import PageContainer from "@/components/layout/page-container";
import UPIForm from "@/features/outlet/components/upi-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function UPIPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="UPI" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="UPI" pageDescription="Outlet — Billing UPI collect ID">
      <UPIForm initialData={{ upi_id: outlet.upi_id ?? "" }} />
    </PageContainer>
  );
}

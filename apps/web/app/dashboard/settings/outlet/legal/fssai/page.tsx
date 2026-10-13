"use client";

import PageContainer from "@/components/layout/page-container";
import FSSAIForm from "@/features/outlet/components/fssai-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function FSSAIPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="FSSAI" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="FSSAI">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="FSSAI" pageDescription="Outlet — FSSAI">
      <FSSAIForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{ fssai_number: outlet.fssai_number ?? "" }}
      />
    </PageContainer>
  );
}

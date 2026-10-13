"use client";

import PageContainer from "@/components/layout/page-container";
import BasicInformationForm from "@/features/outlet/components/basic-information-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function BasicInformationPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();

  if (isPending)
    return (
      <PageContainer pageTitle="Basic Information" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Basic Information">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Basic Information"
      pageDescription="Outlet — General basic information"
    >
      <BasicInformationForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          name: outlet.name,
          code: outlet.code,
          alias: outlet.alias ?? "",
          type: outlet.type,
          logo_url: undefined,
          is_active: outlet.is_active,
        }}
      />
    </PageContainer>
  );
}

"use client";

import PageContainer from "@/components/layout/page-container";
import BasicInformationForm from "@/features/outlet/components/basic-information-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function BasicInformationPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);

  if (isPending || !outlet) {
    return (
      <PageContainer pageTitle="Basic Information" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Basic Information"
      pageDescription="Outlet — General basic information"
    >
      <BasicInformationForm
        initialData={{
          name: outlet.name,
          code: outlet.code,
          alias: outlet.alias ?? "",
          type: outlet.type,
          logo_url: undefined,
          is_active: outlet.is_active,
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div>ID: {outlet.id}</div>
        <div>Organization: {outlet.organization_id}</div>
        <div>Created: {new Date(outlet.created_at).toLocaleDateString()}</div>
        <div>Updated: {new Date(outlet.updated_at).toLocaleDateString()}</div>
      </div>
    </PageContainer>
  );
}

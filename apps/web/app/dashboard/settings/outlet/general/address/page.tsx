"use client";

import PageContainer from "@pixa/ui/layout/page-container";
import AddressForm from "@/features/outlet/components/address-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function AddressPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Address" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Address">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Address" pageDescription="Outlet — General address">
      <AddressForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          address_line_1: outlet.address_line_1,
          address_line_2: outlet.address_line_2 ?? "",
          locality: outlet.locality,
          city: outlet.city,
          district: outlet.district ?? "",
          state: outlet.state,
          country: outlet.country,
          postal_code: outlet.postal_code,
          latitude: outlet.latitude,
          longitude: outlet.longitude,
        }}
      />
    </PageContainer>
  );
}

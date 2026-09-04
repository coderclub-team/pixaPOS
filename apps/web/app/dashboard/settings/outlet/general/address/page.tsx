"use client";

import PageContainer from "@/components/layout/page-container";
import AddressForm from "@/features/outlet/components/address-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function AddressPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Address" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Address" pageDescription="Outlet — General address">
      <AddressForm
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

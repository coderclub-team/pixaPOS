"use client";

import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import PromoForm from "@/features/promos/components/promo-form";
import { promoQueryOptions } from "@/features/promos/api/queries";

export default function EditPromoPage({ params }: { params: { promoId: string } }) {
  const { data: promo, isPending } = useQuery(promoQueryOptions(params.promoId));
  if (isPending || !promo)
    return (
      <PageContainer pageTitle="Edit Promo" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle={`Edit ${promo.code}`} pageDescription="Marketing — Edit promo">
      <PromoForm initialData={promo} />
    </PageContainer>
  );
}

"use client";

import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import PromoForm from "@/features/promos/components/promo-form";

export default function NewPromoPage() {
  return (
    <PageContainer pageTitle="New Promo" pageDescription="Marketing — New promo">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <PromoForm />
      </Suspense>
    </PageContainer>
  );
}

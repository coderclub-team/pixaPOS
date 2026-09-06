import PageContainer from "@/components/layout/page-container";
import SupplierAdjustmentForm from "@/features/inventory/components/supplier-adjustment-form";
import { Suspense } from "react";

export const metadata = { title: "Dashboard : New Adjustment" };

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">Loading…</div>}
        >
          <SupplierAdjustmentForm />
        </Suspense>
      </div>
    </PageContainer>
  );
}

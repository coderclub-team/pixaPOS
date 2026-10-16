import PageContainer from "@pixa/ui/layout/page-container";
import PurchaseForm from "@/features/inventory/components/purchase-form";
import { Suspense } from "react";

export const metadata = { title: "Dashboard : New Purchase" };

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">Loading…</div>}
        >
          <PurchaseForm pageTitle="Create Purchase" />
        </Suspense>
      </div>
    </PageContainer>
  );
}

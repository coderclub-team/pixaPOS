import PageContainer from "@/components/layout/page-container";
import PurchaseReturnForm from "@/features/inventory/components/purchase-return-form";
import { Suspense } from "react";

export const metadata = { title: "Dashboard : New Return" };

export default async function Page(props: { searchParams: Promise<{ purchaseId?: string }> }) {
  const sp = await props.searchParams;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">Loading…</div>}
        >
          <PurchaseReturnForm purchaseId={sp.purchaseId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

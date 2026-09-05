import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { purchaseOrderQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@/components/layout/page-container";
import PurchaseOrderViewPage from "@/features/inventory/components/purchase-order-view-page";

export const metadata = { title: "Dashboard : Purchase Order" };
type PageProps = { params: Promise<{ poId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(purchaseOrderQueryOptions(params.poId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PurchaseOrderViewPage poId={params.poId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

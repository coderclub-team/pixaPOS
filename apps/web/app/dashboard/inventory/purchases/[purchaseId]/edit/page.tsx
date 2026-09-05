import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { purchaseQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@/components/layout/page-container";
import PurchaseEditPage from "@/features/inventory/components/purchase-edit-page";

export const metadata = { title: "Dashboard : Edit Purchase" };
type PageProps = { params: Promise<{ purchaseId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(purchaseQueryOptions(params.purchaseId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PurchaseEditPage purchaseId={params.purchaseId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

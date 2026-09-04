import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { purchaseOrderQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@/components/layout/page-container";
import PurchaseOrderEditPage from "@/features/inventory/components/purchase-order-edit-page";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Edit Purchase Order" };
type PageProps = { params: Promise<{ poId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const { has } = await auth();
  if (!has({ permission: "org:purchases:manage" }))
    redirect("/dashboard/inventory/purchase-orders");
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(purchaseOrderQueryOptions(params.poId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PurchaseOrderEditPage poId={params.poId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

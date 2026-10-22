import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { supplierQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@pixa/ui/layout/page-container";
import { FormSkeleton } from "@pixa/ui/base-ui/form-skeleton";
import SupplierViewPage from "@/features/inventory/components/supplier-view-page";

export const metadata = { title: "Dashboard : Supplier" };
type PageProps = { params: Promise<{ supplierId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  if (params.supplierId !== "new")
    void queryClient.prefetchQuery(supplierQueryOptions(params.supplierId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<FormSkeleton fieldCount={7} />}>
            <SupplierViewPage supplierId={params.supplierId} />
          </Suspense>
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

import PageContainer from "@/components/layout/page-container";
import SupplierAdjustmentForm from "@/features/inventory/components/supplier-adjustment-form";
import { supplierAdjustmentQueryOptions } from "@/features/inventory/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export const metadata = { title: "Dashboard : Edit Adjustment" };
type PageProps = { params: Promise<{ adjustmentId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(supplierAdjustmentQueryOptions(params.adjustmentId));
  const data = queryClient.getQueryData([
    "inventory",
    "supplier-adjustment",
    params.adjustmentId,
  ]) as any;
  const initialData = (data ?? null) as any;
  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex-1 space-y-4">
          {initialData && initialData.status !== "draft" ? (
            <div className="mx-auto w-full max-w-4xl rounded-lg border p-6 text-center">
              <p className="font-medium">
                Cannot edit {initialData.adjustment_number} — {initialData.status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only draft adjustments can be edited — posted is locked, create new one.
              </p>
            </div>
          ) : (
            <SupplierAdjustmentForm
              initialData={initialData}
              pageTitle={
                initialData ? `Update ${initialData.adjustment_number}` : "Update Adjustment"
              }
            />
          )}
        </div>
      </HydrationBoundary>
    </PageContainer>
  );
}

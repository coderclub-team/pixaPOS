import PageContainer from "@/components/layout/page-container";
import SupplierAdjustmentDetail from "@/features/inventory/components/supplier-adjustment-detail";

export const metadata = { title: "Dashboard : Adjustment" };
type PageProps = { params: Promise<{ adjustmentId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <SupplierAdjustmentDetail adjustmentId={params.adjustmentId} />
      </div>
    </PageContainer>
  );
}

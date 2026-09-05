import PageContainer from "@/components/layout/page-container";
import PurchaseOrderEditPage from "@/features/inventory/components/purchase-order-edit-page";

export const metadata = { title: "Dashboard : Purchase Order" };
type PageProps = { params: Promise<{ poId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseOrderEditPage poId={params.poId} />
      </div>
    </PageContainer>
  );
}

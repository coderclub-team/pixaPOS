import PageContainer from "@/components/layout/page-container";
import PurchaseEditPage from "@/features/inventory/components/purchase-edit-page";

export const metadata = { title: "Dashboard : Purchase" };
type PageProps = { params: Promise<{ purchaseId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseEditPage purchaseId={params.purchaseId} />
      </div>
    </PageContainer>
  );
}

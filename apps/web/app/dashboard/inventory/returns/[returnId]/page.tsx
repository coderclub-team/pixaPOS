import PageContainer from "@/components/layout/page-container";
import PurchaseReturnDetail from "@/features/inventory/components/purchase-return-detail";

export const metadata = { title: "Dashboard : Return" };
type PageProps = { params: Promise<{ returnId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseReturnDetail returnId={params.returnId} />
      </div>
    </PageContainer>
  );
}

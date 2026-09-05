import PageContainer from "@/components/layout/page-container";
import PurchaseForm from "@/features/inventory/components/purchase-form";

export const metadata = { title: "Dashboard : New Purchase" };

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseForm pageTitle="Create Purchase" />
      </div>
    </PageContainer>
  );
}

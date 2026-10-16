import PageContainer from "@pixa/ui/layout/page-container";
import PurchaseOrderForm from "@/features/inventory/components/purchase-order-form";

export const metadata = { title: "Dashboard : New Purchase Order" };

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseOrderForm pageTitle="Create Purchase Order" />
      </div>
    </PageContainer>
  );
}

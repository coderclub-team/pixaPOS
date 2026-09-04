import PageContainer from "@/components/layout/page-container";
import PurchaseOrderForm from "@/features/inventory/components/purchase-order-form";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : New Purchase Order" };

export default async function Page() {
  const { has } = await auth();
  if (!has({ permission: "org:purchases:manage" }))
    redirect("/dashboard/inventory/purchase-orders");
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <PurchaseOrderForm pageTitle="Create Purchase Order" />
      </div>
    </PageContainer>
  );
}

import PageContainer from "@/components/layout/page-container";
import WasteForm from "@/features/inventory/components/waste-form";
import { hasDevBypass } from "@/lib/authz";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Log Waste" };

export default async function Page() {
  const { has } = await auth();
  if (!hasDevBypass() && !has({ permission: "org:waste:manage" }))
    redirect("/dashboard/inventory/waste");
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <WasteForm pageTitle="Log Food Waste" />
      </div>
    </PageContainer>
  );
}

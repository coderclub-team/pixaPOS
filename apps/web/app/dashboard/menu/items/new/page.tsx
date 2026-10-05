import PageContainer from "@/components/layout/page-container";
import MenuForm from "@/features/menu/components/menu-form";

export const metadata = { title: "Dashboard : New Product" };
export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <MenuForm pageTitle="New Product" />
      </div>
    </PageContainer>
  );
}

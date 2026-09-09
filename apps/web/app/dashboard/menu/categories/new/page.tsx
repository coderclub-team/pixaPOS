import PageContainer from "@/components/layout/page-container";
import MenuCategoryForm from "@/features/menu/components/menu-category-form";

export const metadata = { title: "Dashboard : New Category" };
export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <MenuCategoryForm pageTitle="New Category" />
      </div>
    </PageContainer>
  );
}

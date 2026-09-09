import PageContainer from "@/components/layout/page-container";
import RecipeForm from "@/features/inventory/components/recipe-form";

export const metadata = { title: "Dashboard : New Recipe" };
export default async function Page() {
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <RecipeForm initialData={null} pageTitle="New Recipe" />
      </div>
    </PageContainer>
  );
}

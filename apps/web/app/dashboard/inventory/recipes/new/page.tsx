import PageContainer from "@/components/layout/page-container";
import RecipeForm from "@/features/inventory/components/recipe-form";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : New Recipe" };
export default async function Page() {
  const { has } = await auth();
  if (!has({ permission: "org:recipes:manage" })) redirect("/dashboard/inventory/recipes");
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <RecipeForm initialData={null} pageTitle="New Recipe" />
      </div>
    </PageContainer>
  );
}

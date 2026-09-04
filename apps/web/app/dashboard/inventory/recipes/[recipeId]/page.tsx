import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { recipeQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@/components/layout/page-container";
import RecipeViewPage from "@/features/inventory/components/recipe-view-page";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Recipe" };
type PageProps = { params: Promise<{ recipeId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const { has } = await auth();
  if (!has({ permission: "org:recipes:manage" })) redirect("/dashboard/inventory/recipes");
  const queryClient = getQueryClient();
  if (params.recipeId !== "new")
    void queryClient.prefetchQuery(recipeQueryOptions(params.recipeId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RecipeViewPage recipeId={params.recipeId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

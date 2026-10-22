import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { recipeQueryOptions } from "@/features/inventory/api/queries";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";
import PageContainer from "@pixa/ui/layout/page-container";
import RecipeCardPage from "@/features/inventory/components/recipe-card-page";

export const metadata = { title: "Dashboard : Recipe Card" };
type PageProps = { params: Promise<{ recipeId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(recipeQueryOptions(params.recipeId));
  void queryClient.prefetchQuery(menuItemsQueryOptions({}));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <PageContainer
            pageTitle="Recipe Card"
            pageDescription="Inventory — Recipe card"
            isLoading
          >
            <div />
          </PageContainer>
        }
      >
        <RecipeCardPage recipeId={params.recipeId} />
      </Suspense>
    </HydrationBoundary>
  );
}

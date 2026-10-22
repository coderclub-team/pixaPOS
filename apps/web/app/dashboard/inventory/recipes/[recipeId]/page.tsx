import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { recipeQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@pixa/ui/layout/page-container";
import { FormSkeleton } from "@pixa/ui/base-ui/form-skeleton";
import RecipeViewPage from "@/features/inventory/components/recipe-view-page";

export const metadata = { title: "Dashboard : Recipe" };
type PageProps = { params: Promise<{ recipeId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();
  if (params.recipeId !== "new")
    void queryClient.prefetchQuery(recipeQueryOptions(params.recipeId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<FormSkeleton fieldCount={10} />}>
            <RecipeViewPage recipeId={params.recipeId} />
          </Suspense>
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

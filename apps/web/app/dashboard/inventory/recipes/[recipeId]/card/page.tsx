import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { recipeQueryOptions } from "@/features/inventory/api/queries";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";
import RecipeCardPage from "@/features/inventory/components/recipe-card-page";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Recipe Card" };
type PageProps = { params: Promise<{ recipeId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const { has } = await auth();
  if (!has({ permission: "org:recipes:manage" })) redirect("/dashboard/inventory/recipes");
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(recipeQueryOptions(params.recipeId));
  void queryClient.prefetchQuery(menuItemsQueryOptions({}));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecipeCardPage recipeId={params.recipeId} />
    </HydrationBoundary>
  );
}

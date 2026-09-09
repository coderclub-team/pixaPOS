import PageContainer from "@/components/layout/page-container";
import MenuCategoryForm from "@/features/menu/components/menu-category-form";
import { menuCategoryQueryOptions } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

type Props = { params: Promise<{ categoryId: string }> };
export default async function Page(props: Props) {
  const params = await props.params;
  const qc = getQueryClient();
  await qc.prefetchQuery(menuCategoryQueryOptions(params.categoryId));
  const data = qc.getQueryData(["menu", "category", params.categoryId]) as any;
  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(qc)}>
        <div className="flex-1 space-y-4">
          <MenuCategoryForm
            initialData={data ?? null}
            pageTitle={data ? `Update ${data.name}` : "Update Category"}
          />
        </div>
      </HydrationBoundary>
    </PageContainer>
  );
}

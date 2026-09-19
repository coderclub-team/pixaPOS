import Link from "next/link";
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
  if (!data) {
    return (
      <PageContainer
        pageTitle="Category not found"
        pageDescription="This category doesn't exist in this session — it may predate saved data."
      >
        <Link href="/dashboard/menu/categories" className="text-sm underline underline-offset-4">
          Back to categories
        </Link>
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(qc)}>
        <div className="flex-1 space-y-4">
          <MenuCategoryForm
            initialData={data}
            categoryId={params.categoryId}
            pageTitle={data.name}
          />
        </div>
      </HydrationBoundary>
    </PageContainer>
  );
}

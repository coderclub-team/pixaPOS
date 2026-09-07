import PageContainer from "@/components/layout/page-container";
import MenuForm from "@/features/menu/components/menu-form";
import { menuItemQueryOptions } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

type Props = { params: Promise<{ itemId: string }> };
export default async function Page(props: Props) {
  const params = await props.params;
  const qc = getQueryClient();
  await qc.prefetchQuery(menuItemQueryOptions(params.itemId));
  const data = qc.getQueryData(["menu", "item", params.itemId]) as any;
  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(qc)}>
        <div className="flex-1 space-y-4">
          <MenuForm
            initialData={data ?? null}
            pageTitle={data ? `Update ${data.name}` : "Update Menu Item"}
          />
        </div>
      </HydrationBoundary>
    </PageContainer>
  );
}

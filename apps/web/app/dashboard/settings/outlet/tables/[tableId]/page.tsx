import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { tableQueryOptions } from "@/features/table/api/queries";
import PageContainer from "@/components/layout/page-container";
import TableViewPage from "@/features/table/components/table-view-page";

export const metadata = {
  title: "Dashboard : Table",
};

type PageProps = { params: Promise<{ tableId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  if (params.tableId !== "new") {
    void queryClient.prefetchQuery(tableQueryOptions(params.tableId));
  }

  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TableViewPage tableId={params.tableId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

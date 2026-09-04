import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { floorQueryOptions } from "@/features/floor/api/queries";
import PageContainer from "@/components/layout/page-container";
import FloorViewPage from "@/features/floor/components/floor-view-page";

export const metadata = {
  title: "Dashboard : Floor",
};

type PageProps = { params: Promise<{ floorId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  if (params.floorId !== "new") {
    void queryClient.prefetchQuery(floorQueryOptions(params.floorId));
  }

  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FloorViewPage floorId={params.floorId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { userQueryOptions } from "@/features/users/api/queries";
import PageContainer from "@/components/layout/page-container";
import UserViewPage from "@/features/users/components/user-view-page";

export const metadata = {
  title: "Dashboard : User",
};

type PageProps = { params: Promise<{ userId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  if (params.userId !== "new") {
    const id = Number(params.userId);
    if (!Number.isNaN(id)) {
      void queryClient.prefetchQuery(userQueryOptions(id));
    }
  }

  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <UserViewPage userId={params.userId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { userQueryOptions } from "@/features/users/api/queries";
import { baOrgId } from "@pixa/server";
import PageContainer from "@pixa/ui/layout/page-container";
import { FormSkeleton } from "@pixa/ui/base-ui/form-skeleton";
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
    const orgId = (await baOrgId().catch(() => null)) ?? "";
    if (!Number.isNaN(id) && orgId !== "") {
      void queryClient.prefetchQuery(userQueryOptions(orgId, id));
    }
  }

  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<FormSkeleton fieldCount={6} />}>
            <UserViewPage userId={params.userId} />
          </Suspense>
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

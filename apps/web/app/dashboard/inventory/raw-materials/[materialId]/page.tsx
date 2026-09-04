import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { rawMaterialQueryOptions } from "@/features/inventory/api/queries";
import PageContainer from "@/components/layout/page-container";
import RawMaterialViewPage from "@/features/inventory/components/raw-material-view-page";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Raw Material" };
type PageProps = { params: Promise<{ materialId: string }> };
export default async function Page(props: PageProps) {
  const params = await props.params;
  const { has } = await auth();
  if (!has({ permission: "org:inventory:manage" })) redirect("/dashboard/inventory/raw-materials");
  const queryClient = getQueryClient();
  if (params.materialId !== "new")
    void queryClient.prefetchQuery(rawMaterialQueryOptions(params.materialId));
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RawMaterialViewPage materialId={params.materialId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}

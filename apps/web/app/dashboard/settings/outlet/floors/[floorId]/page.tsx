import { Suspense } from "react";
import { redirect } from "next/navigation";
import PageContainer from "@pixa/ui/layout/page-container";
import FloorViewPage from "@/features/floor/components/floor-view-page";
import { orgHasOutlets } from "@/features/outlet/api/server-outlets";

export const metadata = {
  title: "Dashboard : Floor",
};

type PageProps = { params: Promise<{ floorId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;

  // "New" has no parent row to inherit an outlet from — with zero outlets in
  // the org there is nothing to attach to, so send the user to outlet setup
  // instead of a form that can never save.
  if (params.floorId === "new" && !(await orgHasOutlets())) {
    redirect("/dashboard/settings/outlets");
  }

  // NOTE: no server prefetch here. The floor service is a localStorage-backed
  // mock — the server's in-memory store never sees client-created rows, so a
  // prefetched `null` would hydrate and 404 every new floor.
  // The client component fetches from the hydrated store instead.
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading floor…</div>}>
          <FloorViewPage floorId={params.floorId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

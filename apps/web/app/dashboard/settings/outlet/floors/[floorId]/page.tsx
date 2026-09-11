import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import FloorViewPage from "@/features/floor/components/floor-view-page";

export const metadata = {
  title: "Dashboard : Floor",
};

type PageProps = { params: Promise<{ floorId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;

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

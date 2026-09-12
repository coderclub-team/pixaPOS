import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import MenuViewPage from "@/features/menu/components/menu-view-page";

type Props = { params: Promise<{ itemId: string }> };

export default async function Page(props: Props) {
  const params = await props.params;
  // NOTE: client fetches from the store (uniform with tables/orders/
  // customers detail pages — no server prefetch staleness).
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading item…</div>}>
          <MenuViewPage itemId={params.itemId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

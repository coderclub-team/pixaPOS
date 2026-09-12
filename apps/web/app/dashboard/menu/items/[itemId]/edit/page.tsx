import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import MenuEditView from "@/features/menu/components/menu-edit-view";

type Props = { params: Promise<{ itemId: string }> };

export default async function Page(props: Props) {
  const params = await props.params;
  // NOTE: client fetches from the store (uniform with other detail pages —
  // no server prefetch staleness).
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading item…</div>}>
          <MenuEditView itemId={params.itemId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import TableViewPage from "@/features/table/components/table-view-page";

export const metadata = {
  title: "Dashboard : Table",
};

type PageProps = {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ duplicate_from?: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  // NOTE: no server prefetch here. The table service is a localStorage-backed
  // mock — the server's in-memory store never sees client-created rows, so a
  // prefetched `null` would hydrate and 404 every new/duplicated table.
  // The client component fetches from the hydrated store instead.
  const duplicateFromId =
    params.tableId === "new" ? searchParams.duplicate_from : undefined;

  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading table…</div>}>
          <TableViewPage tableId={params.tableId} duplicateFromId={duplicateFromId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

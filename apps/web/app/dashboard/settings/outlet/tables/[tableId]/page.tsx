import { Suspense } from "react";
import { redirect } from "next/navigation";
import PageContainer from "@pixa/ui/layout/page-container";
import TableViewPage from "@/features/table/components/table-view-page";
import { orgHasOutlets } from "@/features/outlet/api/server-outlets";

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
  // Same gate as floors/[floorId]: "new" with zero org outlets redirects
  // to outlet setup — even duplicates need an outlet to land in.
  if (params.tableId === "new" && !(await orgHasOutlets())) {
    redirect("/dashboard/settings/outlets");
  }
  const duplicateFromId = params.tableId === "new" ? searchParams.duplicate_from : undefined;

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

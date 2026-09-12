import { Suspense } from "react";
import PageContainer from "@/components/layout/page-container";
import CustomerViewPage from "@/features/customers/components/customer-view-page";

type PageProps = { params: Promise<{ customerId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  // NOTE: no server prefetch — customer store is a localStorage-backed mock
  // (same rule as tables/orders). Client fetches from the hydrated store.
  return (
    <PageContainer>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading customer…</div>}>
          <CustomerViewPage customerId={params.customerId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

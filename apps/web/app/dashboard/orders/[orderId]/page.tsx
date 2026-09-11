import { Suspense } from "react";
import OrderWorkspacePage from "@/features/orders/components/order-workspace";

type PageProps = { params: Promise<{ orderId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  // NOTE: no server prefetch — order/KOT stores are localStorage-backed mocks
  // (same reason as tables/[tableId]). Client fetches from the hydrated store.
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading order…</div>}>
      <OrderWorkspacePage orderId={params.orderId} />
    </Suspense>
  );
}

import { Suspense } from "react";
import AddItemsPage from "@/features/orders/components/add-items-page";

type PageProps = { params: Promise<{ orderId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading menu…</div>}>
      <AddItemsPage orderId={params.orderId} />
    </Suspense>
  );
}

import OrderNewPage from "@/features/orders/components/order-new-page";
import { Suspense } from "react";

export const metadata = { title: "Dashboard : New Order" };

export default async function Page() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading…</div>}>
      <OrderNewPage />
    </Suspense>
  );
}

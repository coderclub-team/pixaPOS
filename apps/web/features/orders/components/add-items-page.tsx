"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { orderQueryOptions } from "@/features/orders/api/queries";
import ItemPicker from "@/features/orders/components/item-picker";

export default function AddItemsPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data: order } = useQuery(orderQueryOptions(orderId));

  return (
    <PageContainer
      pageTitle={`Add items${order ? ` — ${order.order_number}` : ""}`}
      pageDescription="Search the menu, pick variants and add-ons, set quantity."
      pageHeaderAction={
        <Button variant="outline" onClick={() => router.push(`/dashboard/orders/${orderId}`)}>
          Back to order
        </Button>
      }
    >
      <ItemPicker orderId={orderId} />
    </PageContainer>
  );
}

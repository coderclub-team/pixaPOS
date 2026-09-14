"use client";

import { useEffect, useRef, useState } from "react";
import PageContainer from "@/components/layout/page-container";
import OrderForm from "./order-form";
import OrderWorkspacePage from "./order-workspace";
import { deleteOrder, getOrderById } from "../api/service";
import type { OrderWithDerived } from "../api/types";
import { toast } from "sonner";

/**
 * /new two-phase flow: a compact start block first, then the real workspace —
 * identical to the detail page by construction (same component). Exiting with
 * zero fired KOTs discards the empty cart; deleteOrder refuses fired orders,
 * so a concurrent fire from another tab can never destroy real work.
 */
export default function OrderNewPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      const id = idRef.current;
      if (!id) return;
      getOrderById(id)
        .then((o) => {
          if (o && o.kot_count === 0) {
            return deleteOrder(id)
              .then(() => toast("Empty order discarded — nothing was fired."))
              .catch(() => {});
          }
        })
        .catch(() => {});
    },
    [],
  );

  if (!orderId) {
    return (
      <PageContainer>
        <div className="mx-auto w-full max-w-2xl flex-1 space-y-4">
          <OrderForm
            pageTitle="New Order"
            onCreated={(o: OrderWithDerived) => {
              idRef.current = o.id;
              setOrderId(o.id);
            }}
          />
        </div>
      </PageContainer>
    );
  }

  return <OrderWorkspacePage orderId={orderId} />;
}

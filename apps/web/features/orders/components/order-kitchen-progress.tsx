"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@pixa/ui/lib/utils";
import { kotsByOrderQueryOptions } from "@/features/kitchen/api/queries";
import type { OrderWithDerived } from "../api/types";
import OrderStatusText from "./order-status";

/**
 * Shared kitchen-progress readout — one component, one derivation, rendered
 * on the orders list, the order detail and anywhere else a status appears,
 * so every surface agrees (Toast/Lightspeed rule: an order is ready only
 * when every item is ready; partial progress is shown, not hidden).
 */
export function useOrderKitchenProgress(orderId: string) {
  const { data: kots } = useQuery(kotsByOrderQueryOptions(orderId));
  const lines = (kots ?? [])
    .filter((k) => k.status !== "CANCELLED")
    .flatMap((k) => k.lines.filter((l) => l.qty - l.voided_qty > 0));
  const total = lines.length;
  const done = lines.filter((l) => l.status === "READY" || l.status === "SERVED").length;
  const cooking = lines.filter((l) => l.status === "PREPARING").length;
  return { total, done, cooking, hasFired: (kots ?? []).length > 0 };
}

export default function OrderKitchenProgress({
  orderId,
  className,
}: {
  orderId: string;
  className?: string;
}) {
  const { total, done } = useOrderKitchenProgress(orderId);
  if (total === 0) return null;
  return (
    <span className={cn("text-[11px] text-muted-foreground", className)}>
      {done}/{total} ready
    </span>
  );
}

/**
 * The one agreed status readout: kitchen-stage pill with item progress
 * ("Preparing · 3/5"). Progress comes from order fields (computed in
 * getters, zero queries), so polling the list stays cheap. Rendered on the
 * list and the detail header — both pages share the status.
 *
 * NOTE (future notifications phase): this is the hook point — the
 * newly-READY transition below is exactly where a toast/sound/push
 * notification should fire.
 */
export function OrderStatusPill({ order }: { order: OrderWithDerived }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(order.status);

  useEffect(() => {
    if (prev.current !== "READY" && order.status === "READY") {
      // FUTURE NOTIFICATIONS: fire toast/sound/push here (order just turned ready).
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 3000);
      prev.current = order.status;
      return () => window.clearTimeout(t);
    }
    prev.current = order.status;
  }, [order.status]);

  return (
    <span className={cn(flash && "animate-pulse rounded bg-green-500/10 px-1")}>
      <OrderStatusText
        status={order.status}
        progress={{ done: order.kitchen_done, total: order.kitchen_total }}
      />
    </span>
  );
}

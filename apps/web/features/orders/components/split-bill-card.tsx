"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { SplitSection } from "./bill-panel";

/**
 * Standalone Split Bill card for the order detail route: mode tabs +
 * builder when unsplit/editing, share list with edit/remove when settled.
 * Terminal orders render nothing unless a split already exists (read-only).
 */
export default function SplitBillCard({
  orderId,
  activePartition,
  onSelectPartition,
}: {
  orderId: string;
  activePartition: string | null;
  onSelectPartition: (label: string | null) => void;
}) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [mode, setMode] = useState<"none" | "equal" | "itemwise" | "custom">("none");

  if (!order) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Loading split…
        </CardContent>
      </Card>
    );
  }

  const isTerminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  if (isTerminal && !order.split) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Split Bill</CardTitle>
      </CardHeader>
      <CardContent>
        <SplitSection
          orderId={orderId}
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            onSelectPartition(null);
          }}
          activePartition={activePartition}
          onSelectPartition={onSelectPartition}
        />
      </CardContent>
    </Card>
  );
}

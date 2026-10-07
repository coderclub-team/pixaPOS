"use client";

import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { formatINR } from "@/lib/money";
import { formatAge } from "@/lib/utils";
import type { OverviewRecentOrder } from "../api/types";

/** Live sales feed — most recent sales with channel + amount. */
export function LiveSales({ data }: { data: OverviewRecentOrder[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Live sales</CardTitle>
        <CardDescription>Latest orders in the selected range</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyTitle>No sales yet</EmptyTitle>
              <EmptyDescription>Orders appear here as they are fired.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {data.map((o) => (
              <li key={o.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.order_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.table_number ? `Table ${o.table_number}` : (o.customer_name ?? "Walk-in")} ·{" "}
                    {formatAge(o.created_at)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {o.channel_label}
                </Badge>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatINR(o.total_paise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

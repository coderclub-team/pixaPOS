"use client";

import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { formatINR } from "@/lib/money";
import type { OverviewItem } from "../api/types";

function ItemList({ items, tone }: { items: OverviewItem[]; tone: "top" | "slow" }) {
  if (items.length === 0) {
    return (
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyTitle>No items sold</EmptyTitle>
          <EmptyDescription>Nothing in this range yet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={`${it.menu_item_id}-${i}`} className="flex items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">{it.name}</span>
          <Badge
            variant={tone === "top" ? "default" : "secondary"}
            className="shrink-0 tabular-nums"
          >
            {it.qty} sold
          </Badge>
          <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
            {formatINR(it.net_paise)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Menu movers — best sellers to push, slowest to promote or 86. */
export function ItemMovers({ top, slow }: { top: OverviewItem[]; slow: OverviewItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Menu movers</CardTitle>
        <CardDescription>Best sellers to push · slowest to promote or 86</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Top sellers
          </p>
          <ItemList items={top} tone="top" />
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Slow movers
          </p>
          <ItemList items={slow} tone="slow" />
        </div>
      </CardContent>
    </Card>
  );
}

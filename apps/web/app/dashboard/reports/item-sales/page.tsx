"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Button } from "@pixa/ui/base-ui/button";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import Link from "next/link";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { SortTh, useSorting } from "@/components/sort-th";
import { ExportButton } from "@/features/system/components/io-dialog";
import type { CsvColumn } from "@/features/system/lib/csv";
import { itemSalesQueryOptions } from "@/features/orders/api/queries";
import type { ItemSalesStat } from "@/features/orders/api/types";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const;

type Band = "top" | "average" | "slow";

export type SalesRow = ItemSalesStat & { band: Band };

const columns: CsvColumn<SalesRow>[] = [
  { key: "name", label: "Item", get: (r) => r.name },
  { key: "variant", label: "Variant", get: (r) => r.variant_name ?? "" },
  { key: "category", label: "Category", get: (r) => r.category_name ?? "" },
  { key: "band", label: "Band", get: (r) => r.band },
  { key: "qty", label: "Qty Sold", get: (r) => r.qty },
  { key: "orders", label: "Orders", get: (r) => r.orders },
  { key: "gross", label: "Gross (Rs)", get: (r) => Math.round(r.gross_paise / 100) },
  { key: "discount", label: "Discount (Rs)", get: (r) => Math.round(r.discount_paise / 100) },
  { key: "net", label: "Net (Rs)", get: (r) => Math.round(r.net_paise / 100) },
];

export default function ItemSalesPage() {
  const [range, setRange] = useState<number>(30);
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [band, setBand] = useState<Band>("top");

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (range - 1));
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [range]);

  const { data: stats, isPending } = useQuery(
    itemSalesQueryOptions({ from, to, channel: channel as any }),
  );
  const { data: menu } = useQuery(menuItemsQueryOptions({}));

  const rows = useMemo<SalesRow[]>(() => {
    const sold = [...(stats ?? [])].sort((a, b) => b.qty - a.qty);
    // Rank bands by quintile: top 20% / middle 60% / bottom 20%.
    const n = sold.length;
    const topCut = Math.max(1, Math.ceil(n * 0.2));
    const slowCut = Math.max(0, Math.floor(n * 0.8));
    const withBands: SalesRow[] = sold.map((s, i) => ({
      ...s,
      band: i < topCut ? "top" : i >= slowCut ? "slow" : "average",
    }));
    if (band !== "slow") return withBands.filter((r) => r.band === band);
    // Slow tab also surfaces active catalog items with zero sales — the
    // clearest promo candidates (dead stock in waiting).
    const soldIds = new Set(sold.map((s) => s.menu_item_id));
    const zeroSale: SalesRow[] = (menu ?? [])
      .filter((m) => m.is_active && !soldIds.has(m.id))
      .map((m) => ({
        menu_item_id: m.id,
        name: m.name,
        category_name: m.category_name,
        qty: 0,
        gross_paise: 0,
        discount_paise: 0,
        net_paise: 0,
        orders: 0,
        band: "slow" as Band,
      }));
    return [...withBands.filter((r) => r.band === "slow"), ...zeroSale];
  }, [stats, menu, band]);

  const { sortKey, sortDir, toggle, sorted } = useSorting<SalesRow>("qty", "desc");
  const visible = sorted(rows, {
    name: (r) => r.name,
    category: (r) => r.category_name ?? "",
    qty: (r) => r.qty,
    orders: (r) => r.orders,
    net: (r) => r.net_paise,
  });

  const counts = useMemo(() => {
    const sold = [...(stats ?? [])].sort((a, b) => b.qty - a.qty);
    const n = sold.length;
    const topCut = Math.max(1, Math.ceil(n * 0.2));
    const slowCut = Math.max(0, Math.floor(n * 0.8));
    const zeroSale = (menu ?? []).filter(
      (m) => m.is_active && !sold.some((s) => s.menu_item_id === m.id),
    ).length;
    return {
      top: topCut > n ? n : Math.min(topCut, n),
      average: Math.max(0, Math.min(n, slowCut) - Math.min(topCut, n)),
      slow: Math.max(0, n - Math.min(n, slowCut)) + zeroSale,
    };
  }, [stats, menu]);

  if (isPending)
    return (
      <PageContainer pageTitle="Item Sales" pageDescription="Reports — Item sales" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Item Sales"
      pageDescription="Top, average and slow sellers — pick promo targets with evidence."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Band">
          {(["top", "average", "slow"] as Band[]).map((b) => (
            <Button
              key={b}
              type="button"
              variant={band === b ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs capitalize"
              onClick={() => setBand(b)}
              title={`${b} sellers`}
            >
              {b} ({counts[b]})
            </Button>
          ))}
        </div>
        <Select value={String(range)} onValueChange={(v) => setRange(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.days} value={String(r.days)}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={channel ?? "all"}
          onValueChange={(v) => setChannel(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="dine_in">Dine-in</SelectItem>
            <SelectItem value="counter">Counter</SelectItem>
            <SelectItem value="takeaway">Takeaway</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto">
          <ExportButton filename={`item-sales-${band}`} rows={visible} columns={columns} />
        </span>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortTh
                    label="Item"
                    column="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Category"
                    column="category"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh
                    label="Qty"
                    column="qty"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                    className="ml-auto"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh
                    label="Orders"
                    column="orders"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                    className="ml-auto"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh
                    label="Net"
                    column="net"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                    className="ml-auto"
                  />
                </TableHead>
                <TableHead className="text-right">Promo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={`${r.menu_item_id}|${r.variant_id ?? ""}`}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.variant_name && (
                      <span className="text-muted-foreground"> · {r.variant_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {r.category_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.qty}</TableCell>
                  <TableCell className="text-right font-mono">{r.orders}</TableCell>
                  <TableCell className="text-right font-mono">{formatINR(r.net_paise)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/marketing/promos/new?scope=item&target=${r.menu_item_id}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-7 text-xs",
                      )}
                      title={`New promo for ${r.name}`}
                    >
                      + Promo
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No sales in this range yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

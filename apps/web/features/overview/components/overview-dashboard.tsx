"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@pixa/ui/base-ui/alert";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pixa/ui/base-ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { getQueryClient } from "@/lib/query-client";
import { overviewKeys, overviewQueryOptions } from "../api/queries";
import {
  CHANNEL_LABELS,
  type OrderChannel,
  type OverviewFilters,
  type OverviewRange,
} from "../api/types";
import { ChannelSplit } from "./channel-split";
import { ItemMovers } from "./item-movers";
import { LiveSales } from "./live-sales";
import { PaymentSplit } from "./payment-split";
import { RevenueTrend } from "./revenue-trend";

const RANGE_LABELS: Record<OverviewRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const CHANNELS: OrderChannel[] = [
  "dine_in",
  "counter",
  "takeaway",
  "delivery",
  "zomato",
  "swiggy",
  "own_online",
];

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <Badge variant="outline" className={cn(up ? "text-emerald-600" : "text-red-600")}>
      {up ? <Icons.trendingUp /> : <Icons.trendingDown />}
      {up ? "+" : ""}
      {pct}%
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  action,
  footer,
  hint,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  hint: string;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {footer && <div className="line-clamp-1 flex gap-2 font-medium">{footer}</div>}
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="flex flex-1 animate-pulse flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <div className="absolute top-4 right-4">
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-2.5 flex-1 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2.5 flex-1 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-7">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  const [range, setRange] = useState<OverviewRange>("today");
  const [channel, setChannel] = useState<OrderChannel | "all">("all");
  const [outlet, setOutlet] = useState<string | "all">("all");
  const [outletOptions, setOutletOptions] = useState<{ id: string; label: string }[]>([]);

  const filters: OverviewFilters = {
    range,
    channel: channel === "all" ? undefined : channel,
    outlet_id: outlet === "all" ? undefined : outlet,
  };

  const { data, isPending, isError, error, refetch } = useQuery(overviewQueryOptions(filters));

  useEffect(() => {
    if (data?.outlets && data.outlets.length > 0) {
      setOutletOptions((prev) => {
        const map = new Map(prev.map((o) => [o.id, o]));
        for (const o of data.outlets) map.set(o.id, o);
        return [...map.values()];
      });
    }
  }, [data]);

  if (isPending) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <Icons.warning className="size-4" aria-hidden />
        <AlertTitle>Could not load the dashboard</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          {error instanceof Error ? error.message : "Unknown error"}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              getQueryClient().invalidateQueries({ queryKey: overviewKeys.all });
              void refetch();
            }}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { kpis } = data;
  const channelNote = channel === "all" ? "All channels" : CHANNEL_LABELS[channel as OrderChannel];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Owner dashboard</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as OverviewRange)}>
            <SelectTrigger className="w-[150px]" aria-label="Range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as OverviewRange[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={(v) => setChannel(v as OrderChannel | "all")}>
            <SelectTrigger className="w-[160px]" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* <Select value={outlet} onValueChange={setOutlet}>
            <SelectTrigger className="w-[160px]" aria-label="Outlet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {outletOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select> */}
          <Button
            variant="outline"
            size="sm"
            title="Refresh"
            onClick={() => getQueryClient().invalidateQueries({ queryKey: overviewKeys.all })}
          >
            <Icons.refresh className="size-4" />
          </Button>
        </div>
      </div>

      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`Revenue · ${RANGE_LABELS[range]}`}
          value={formatINR(kpis.revenue_paise)}
          action={<DeltaBadge pct={kpis.revenue_delta_pct} />}
          footer={
            kpis.revenue_delta_pct === null
              ? "No prior period to compare"
              : kpis.revenue_delta_pct >= 0
                ? "Up on the previous period"
                : "Down on the previous period"
          }
          hint={channelNote}
        />
        <KpiCard
          label="Orders"
          value={kpis.orders.toLocaleString("en-IN")}
          footer={`Average bill ${formatINR(kpis.avg_bill_paise)}`}
          hint={RANGE_LABELS[range]}
        />
        <KpiCard
          label="Live orders"
          value={kpis.live_orders.toLocaleString("en-IN")}
          footer="In kitchen or awaiting serve/handover"
          hint="Right now"
        />
        <KpiCard
          label="Occupied tables"
          value={kpis.occupied_tables.toLocaleString("en-IN")}
          footer="Dine-in tables with an open bill"
          hint="Right now"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="col-span-1 lg:col-span-4">
          <RevenueTrend data={data.trend} rangeLabel={RANGE_LABELS[range]} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <LiveSales data={data.recent} />
        </div>
        <div className="col-span-1 lg:col-span-4">
          <ChannelSplit data={data.channels} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <PaymentSplit data={data.payments} />
        </div>
        <div className="col-span-1 lg:col-span-7">
          <ItemMovers top={data.top_items} slow={data.slow_items} />
        </div>
      </div>
    </div>
  );
}

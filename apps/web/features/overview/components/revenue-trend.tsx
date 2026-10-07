"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@pixa/ui/base-ui/chart";
import { formatINR } from "@/lib/money";
import type { TrendPoint } from "../api/types";

const config = {
  value: { label: "Net sales", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RevenueTrend({ data, rangeLabel }: { data: TrendPoint[]; rangeLabel: string }) {
  const rows = data.map((d) => ({ label: d.label, value: d.net_paise / 100, orders: d.orders }));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sales trend</CardTitle>
        <CardDescription>Net sales · {rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="max-h-[300px] w-full">
          <AreaChart data={rows} accessibilityLayer margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={18}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent formatter={(value) => formatINR(Number(value) * 100)} />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.18}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

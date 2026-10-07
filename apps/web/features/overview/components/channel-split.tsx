"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@pixa/ui/base-ui/chart";
import { formatINR } from "@/lib/money";
import type { ChannelStat } from "../api/types";

const config = {
  value: { label: "Net sales", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Sales by channel — in-house vs online aggregators. */
export function ChannelSplit({ data }: { data: ChannelStat[] }) {
  const rows = data.map((c) => ({ label: c.label, value: c.net_paise / 100, orders: c.orders }));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Orders by channel</CardTitle>
        <CardDescription>In-house vs Zomato / Swiggy / online</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="max-h-[300px] w-full">
          <BarChart data={rows} accessibilityLayer margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent formatter={(value) => formatINR(Number(value) * 100)} />
              }
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

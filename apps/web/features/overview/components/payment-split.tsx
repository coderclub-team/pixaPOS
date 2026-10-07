"use client";

import { Cell, LabelList, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@pixa/ui/base-ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { formatINR } from "@/lib/money";
import { PAYMENT_COLORS, type PaymentStat } from "../api/types";

const config = {
  amount: { label: "Collected" },
  cash: { label: "Cash", color: "var(--chart-1)" },
  upi: { label: "UPI", color: "var(--chart-2)" },
  debit_card: { label: "Debit card", color: "var(--chart-3)" },
  credit_card: { label: "Credit card", color: "var(--chart-4)" },
  bank_transfer: { label: "Bank transfer", color: "var(--chart-5)" },
  wallet: { label: "Wallet", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Payment mix — how guests settle (cash / UPI / cards / wallet). */
export function PaymentSplit({ data }: { data: PaymentStat[] }) {
  const rows = data.map((p, i) => ({
    method: p.method,
    label: p.label,
    amount: p.amount_paise / 100,
    fill: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
  }));
  const total = data.reduce((s, p) => s + p.amount_paise, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Payment mix</CardTitle>
        <CardDescription>
          {total > 0 ? `${formatINR(total)} collected` : "No payments yet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center">
        {rows.length === 0 ? (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyTitle>No payments</EmptyTitle>
              <EmptyDescription>Collected payments appear here by method.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={config}
            className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[260px] min-h-[220px]"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="label"
                    hideLabel
                    formatter={(value) => formatINR(Number(value) * 100)}
                  />
                }
              />
              <Pie
                data={rows}
                innerRadius={45}
                dataKey="amount"
                nameKey="label"
                radius={12}
                cornerRadius={6}
                paddingAngle={3}
              >
                {rows.map((r) => (
                  <Cell key={r.method} fill={r.fill} />
                ))}
                <LabelList
                  dataKey="label"
                  stroke="none"
                  fontSize={11}
                  fontWeight={500}
                  fill="currentColor"
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

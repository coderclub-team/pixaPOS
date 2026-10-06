import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { estimateInfraCost, type LimitMap } from "@pixa/db/plans";
import { RESOURCE_META, formatBytes } from "@/lib/usage-types";

const USD_TO_INR = Number(process.env.USD_TO_INR ?? 87);

export type CostPlan = {
  id: string;
  name: string;
  monthlyPaise: number | null;
  limits: LimitMap;
};

function fmtUsd(usd: number): string {
  if (usd === 0) return "$0";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
}

function fmtInr(usd: number): string {
  return `₹${Math.round(usd * USD_TO_INR).toLocaleString("en-IN")}`;
}

function priceLabel(paise: number | null): string {
  if (paise === null) return "Custom pricing";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN")}/month`;
}

function PlanCostCard({ plan }: { plan: CostPlan }) {
  const { lines, totalUsd } = estimateInfraCost(plan.limits);
  const costInr = totalUsd * USD_TO_INR;
  const revenueInr = plan.monthlyPaise === null ? null : plan.monthlyPaise / 100;
  const marginInr = revenueInr === null ? null : revenueInr - costInr;
  const marginPct =
    revenueInr && revenueInr > 0 && marginInr !== null
      ? Math.round((marginInr / revenueInr) * 100)
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {plan.name}
              <Badge variant="secondary">{priceLabel(plan.monthlyPaise)}</Badge>
            </CardTitle>
            <CardDescription>
              Neon Launch rates — cost if every infrastructure limit is fully used.
            </CardDescription>
          </div>
          {marginPct !== null && marginInr !== null && (
            <Badge variant={marginInr >= 0 ? "default" : "destructive"}>
              Margin {marginInr >= 0 ? "+" : "−"}₹
              {Math.abs(Math.round(marginInr)).toLocaleString("en-IN")} ({marginPct}%)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource limit</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Neon rate (Launch)</TableHead>
              <TableHead className="text-right">Cost if fully used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.resource}>
                <TableCell className="font-medium">{RESOURCE_META[l.resource].label}</TableCell>
                <TableCell className="text-muted-foreground">
                  {l.limit === null ? "Custom" : formatBytes(l.limit)}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.rateLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.note ? (
                    <span className="text-xs text-muted-foreground">~$0 · {l.note}</span>
                  ) : (
                    fmtUsd(l.costUsd)
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold" colSpan={3}>
                Total infrastructure / month
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {fmtUsd(totalUsd)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ≈ {fmtInr(totalUsd)}
                </span>
              </TableCell>
            </TableRow>
            {revenueInr !== null && (
              <TableRow>
                <TableCell className="text-muted-foreground">Revenue</TableCell>
                <TableCell className="text-muted-foreground" colSpan={2}>
                  Plan price
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ₹{revenueInr.toLocaleString("en-IN")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Internal cost/margin analysis for the owner console. Never customer-facing. */
export function PlanCostBreakdown({ plans }: { plans: CostPlan[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {plans.map((p) => (
        <PlanCostCard key={p.id} plan={p} />
      ))}
    </div>
  );
}

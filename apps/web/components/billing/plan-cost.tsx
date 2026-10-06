"use client";

import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
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

function fmtInr(usd: number, rate: number): string {
  return `₹${Math.round(usd * rate).toLocaleString("en-IN")}`;
}

function priceLabel(paise: number | null): string {
  if (paise === null) return "Custom pricing";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN")}/month`;
}

/** Cost/margin table for a single plan (internal only). */
export function PlanCostTable({ plan, usdToInr }: { plan: CostPlan; usdToInr: number }) {
  const { lines, totalUsd } = estimateInfraCost(plan.limits);
  const costInr = totalUsd * usdToInr;
  const revenueInr = plan.monthlyPaise === null ? null : plan.monthlyPaise / 100;
  const marginInr = revenueInr === null ? null : revenueInr - costInr;
  const marginPct =
    revenueInr && revenueInr > 0 && marginInr !== null
      ? Math.round((marginInr / revenueInr) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{priceLabel(plan.monthlyPaise)}</Badge>
        {marginPct !== null && marginInr !== null && (
          <Badge variant={marginInr >= 0 ? "default" : "destructive"}>
            Margin {marginInr >= 0 ? "+" : "−"}₹
            {Math.abs(Math.round(marginInr)).toLocaleString("en-IN")} ({marginPct}%)
          </Badge>
        )}
      </div>
      <div className="-mx-5 overflow-hidden border-y">
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
                  ≈ {fmtInr(totalUsd, usdToInr)}
                </span>
              </TableCell>
            </TableRow>
            {revenueInr !== null && (
              <>
                <TableRow>
                  <TableCell className="text-muted-foreground">Revenue</TableCell>
                  <TableCell className="text-muted-foreground" colSpan={2}>
                    Plan price
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ₹{revenueInr.toLocaleString("en-IN")}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Margin</TableCell>
                  <TableCell className="text-muted-foreground" colSpan={2}>
                    Price − infrastructure
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={marginInr !== null && marginInr < 0 ? "text-destructive" : ""}>
                      {marginInr !== null && marginInr >= 0 ? "+" : "−"}₹
                      {Math.abs(Math.round(marginInr ?? 0)).toLocaleString("en-IN")}
                      {marginPct !== null ? ` (${marginPct}%)` : ""}
                    </span>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Neon Launch rates. Costs in USD; INR equivalent at live USD→INR {usdToInr.toFixed(2)}.
        Internal only — never shown to customers.
      </p>
    </div>
  );
}

/** Info-dialog wrapper for the per-plan cost/margin breakdown. */
export function PlanCostDialog({
  open,
  onOpenChange,
  plan,
  usdToInr,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CostPlan | null;
  usdToInr: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan?.name ?? "Plan"} — cost &amp; margin</DialogTitle>
          <DialogDescription>
            Cost if every infrastructure limit is fully used, versus the plan price.
          </DialogDescription>
        </DialogHeader>
        {plan && <PlanCostTable plan={plan} usdToInr={usdToInr} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

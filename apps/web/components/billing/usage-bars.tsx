import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Progress } from "@pixa/ui/base-ui/progress";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import {
  RESOURCE_META,
  RESOURCE_ORDER,
  buildBar,
  severityIndicatorClass,
  type ResourceLimit,
  type UsageBarData,
  type UsageMap,
} from "@/lib/usage-types";
import type { LimitMap } from "@pixa/db";

export function buildAllBars(usage: UsageMap, limits: LimitMap | null): UsageBarData[] {
  return RESOURCE_ORDER.map((r) => buildBar(r, usage[r] ?? 0, limits ? limits[r] : null));
}

export function worstSeverity(bars: UsageBarData[]): UsageBarData["severity"] {
  const order: UsageBarData["severity"][] = ["ok", "info", "warning", "critical", "blocked"];
  return bars.reduce<UsageBarData["severity"]>(
    (worst, b) => (order.indexOf(b.severity) > order.indexOf(worst) ? b.severity : worst),
    "ok",
  );
}

function Bar({ bar }: { bar: UsageBarData }) {
  const unlimited = bar.limit === null;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {bar.meta.label}
          {bar.meta.monthly && (
            <span className="text-[10px] font-normal text-muted-foreground uppercase">/ mo</span>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {bar.currentLabel}
          <span className="mx-1 text-muted-foreground/60">/</span>
          {bar.limitLabel}
        </span>
      </div>
      <Progress
        value={unlimited ? 0 : bar.pct}
        aria-label={`${bar.meta.label} usage`}
        className={cn("w-full", severityIndicatorClass(bar.severity))}
      >
        <span className="sr-only">
          {bar.currentLabel} of {bar.limitLabel} ({bar.pct}%)
        </span>
      </Progress>
      {bar.severity !== "ok" && !unlimited && (
        <p
          className={cn(
            "text-xs",
            bar.severity === "blocked" || bar.severity === "critical"
              ? "text-destructive"
              : "text-amber-600 dark:text-amber-500",
          )}
        >
          {bar.severity === "blocked"
            ? `${bar.meta.label} limit reached. Upgrade to continue.`
            : bar.severity === "critical"
              ? `You're almost at your ${bar.meta.label.toLowerCase()} limit.`
              : `${bar.pct}% of ${bar.meta.label.toLowerCase()} used.`}
        </p>
      )}
    </div>
  );
}

/**
 * Usage + limits panel. Renders product limits and infrastructure metrics as
 * independent shadcn progress bars. `variant="customer"` uses friendly labels;
 * `variant="admin"` adds the raw infrastructure split (same independent bars).
 */
export function UsageBars({
  planName,
  planPriceLabel,
  bars,
  periodLabel,
  syncLabel,
  variant = "customer",
  className,
}: {
  planName: string;
  planPriceLabel?: string;
  bars: UsageBarData[];
  periodLabel?: string;
  syncLabel?: string;
  variant?: "customer" | "admin";
  className?: string;
}) {
  const product = bars.filter((b) => !RESOURCE_META[b.resource].infra);
  const infra = bars.filter((b) => RESOURCE_META[b.resource].infra);
  const worst = worstSeverity(bars);
  const blocked = bars.filter((b) => b.severity === "blocked");

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Usage &amp; limits
              <Badge variant={worst === "blocked" ? "destructive" : "secondary"}>{planName}</Badge>
            </CardTitle>
            <CardDescription>
              {planPriceLabel ? `${planPriceLabel} · ` : ""}
              {periodLabel ? `Current period ${periodLabel}` : "Current period"}
            </CardDescription>
          </div>
          {variant === "admin" && syncLabel && (
            <span className="text-xs text-muted-foreground">{syncLabel}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {blocked.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <Icons.warning className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {blocked.map((b) => RESOURCE_META[b.resource].label).join(", ")} limit reached.
              Upgrade the plan or free up usage to continue.
            </p>
          </div>
        )}

        <div>
          <h4 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Product limits
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {product.map((b) => (
              <Bar key={b.resource} bar={b} />
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {variant === "admin" ? "Infrastructure usage" : "Storage & usage"}
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {infra.map((b) => (
              <Bar key={b.resource} bar={b} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { ResourceLimit };

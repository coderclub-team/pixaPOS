"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";
import type { LimitMap } from "@pixa/db";
import { UsageBars, buildAllBars } from "@/components/billing/usage-bars";
import { emptyUsage, type UsageMap } from "@/lib/usage-types";

type UsageResponse = {
  ok: boolean;
  plan: {
    id: string;
    name: string;
    tagline: string | null;
    monthlyPaise: number | null;
    flags: Record<string, boolean>;
  };
  limits: LimitMap;
  usage: UsageMap;
  periodStart: string;
  periodEnd: string;
  infraSyncedAt: string | null;
};

const PRICING_URL = process.env.NEXT_PUBLIC_PRICING_URL ?? "https://pixapos.store/#pricing";

function priceLabel(paise: number | null): string {
  if (paise === null) return "Custom pricing";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN")}/month`;
}

export function UsageLimitsPanel() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: async (): Promise<UsageResponse> => {
      const res = await fetch("/api/billing/usage");
      const json = (await res.json().catch(() => null)) as UsageResponse | null;
      if (!res.ok || !json?.ok) throw new Error("usage unavailable");
      return json;
    },
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading usage…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Usage is unavailable right now. It refreshes automatically.
        </CardContent>
      </Card>
    );
  }

  const bars = buildAllBars(data.usage ?? emptyUsage(), data.limits);
  const periodLabel = `${new Date(data.periodStart).toLocaleDateString("en-IN")} – ${new Date(
    data.periodEnd,
  ).toLocaleDateString("en-IN")}`;

  return (
    <div className="space-y-4">
      <UsageBars
        planName={data.plan.name}
        planPriceLabel={priceLabel(data.plan.monthlyPaise)}
        bars={bars}
        periodLabel={periodLabel}
        syncLabel={
          data.infraSyncedAt
            ? `Infrastructure synced ${new Date(data.infraSyncedAt).toLocaleTimeString("en-IN")}`
            : "Infrastructure sync pending"
        }
      />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm text-muted-foreground">
            Need more outlets, orders or storage? Growth raises every limit.
          </div>
          <Button nativeButton={false} render={<a href={PRICING_URL} />}>
            <Icons.arrowRight className="size-4" aria-hidden />
            Upgrade plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

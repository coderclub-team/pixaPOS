"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { resolveLimits, type LimitMap, type ResourceLimit } from "@pixa/db/plans";
import { PlanCostDialog, type CostPlan } from "@/components/billing/plan-cost";
import { RESOURCE_META, RESOURCE_ORDER, formatBytes, formatNumber } from "@/lib/usage-types";

export type CatalogPlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthlyPaise: number | null;
  annualDiscountPct: number;
  features: string[];
  outletLimit: number | null;
  sortOrder: number;
  isActive: boolean;
};

function inr(paise: number | null): string {
  if (paise === null) return "Custom";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function limitValue(resource: ResourceLimit, value: number | null): string {
  if (value === null) return "Custom";
  return RESOURCE_META[resource].unit === "bytes" ? formatBytes(value) : formatNumber(value);
}

async function api(url: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function PlansManager({
  initialPlans,
  limitsById = {},
  usdToInr = 87,
}: {
  initialPlans: CatalogPlan[];
  limitsById?: Record<string, LimitMap>;
  usdToInr?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<CatalogPlan | null>(null);
  const [costTargetId, setCostTargetId] = useState<string | null>(null);

  const costPlans: CostPlan[] = initialPlans.map((p) => ({
    id: p.id,
    name: p.name,
    monthlyPaise: p.monthlyPaise,
    limits: limitsById[p.id] ?? resolveLimits(p.id),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {initialPlans.map((p) => {
          const limits = limitsById[p.id] ?? resolveLimits(p.id);
          return (
            <Card key={p.id} className={cn("flex flex-col", !p.isActive && "opacity-60")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {p.name}
                    {!p.isActive && <Badge variant="secondary">inactive</Badge>}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    title="Cost & margin"
                    aria-label={`Cost and margin for ${p.name}`}
                    onClick={() => setCostTargetId(p.id)}
                  >
                    <Icons.info className="size-4" />
                  </Button>
                </div>
                <p className="text-2xl font-semibold">{inr(p.monthlyPaise)}</p>
                {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
                <p className="text-xs text-muted-foreground">{p.annualDiscountPct}% annual off</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Usage limits
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {RESOURCE_ORDER.map((r) => (
                      <div key={r} className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">{RESOURCE_META[r].short}</dt>
                        <dd className="tabular-nums">{limitValue(r, limits[r])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Features
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <Icons.check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/billing/${p.id}`} />}
                  >
                    <Icons.edit className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      p.isActive ? setDeactivateTarget(p) : void toggleActive(p, true)
                    }
                  >
                    {p.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate plan “{deactivateTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Blocked while any organisation sits on it. New signups stop seeing it immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !deactivateTarget}
              onClick={() => {
                if (!deactivateTarget) return;
                setBusy(true);
                api(`/api/admin/plans/${deactivateTarget.id}`, "PATCH", { isActive: false })
                  .then(() => {
                    toast.success(`Plan ${deactivateTarget.name} deactivated`);
                    setDeactivateTarget(null);
                    router.refresh();
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Confirm deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanCostDialog
        open={!!costTargetId}
        onOpenChange={(v) => !v && setCostTargetId(null)}
        plan={costPlans.find((c) => c.id === costTargetId) ?? null}
        usdToInr={usdToInr}
      />
    </div>
  );

  async function toggleActive(p: CatalogPlan, active: boolean) {
    setBusy(true);
    try {
      await api(`/api/admin/plans/${p.id}`, "PATCH", { isActive: active });
      toast.success(`Plan ${p.name} ${active ? "activated" : "deactivated"}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
}

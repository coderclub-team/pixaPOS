"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { ListToolbar, SearchInput } from "@/components/admin/list-toolbar";
import { RowActionsMenu, DropdownMenuItem } from "@/components/admin/row-actions";
import {
  LoadMoreSentinel,
  TablePagination,
  useResponsiveTableRows,
} from "@/components/admin/data-pagination";
import { SortTh, useSorting } from "@/components/sort-th";
import { resolveLimits, type LimitMap } from "@pixa/db/plans";
import { formatBytes, formatNumber } from "@/lib/usage-types";
import { PlanCostDialog, type CostPlan } from "@/components/billing/plan-cost";

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

async function api(url: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function PlansTable({
  initial,
  limitsById = {},
  usdToInr = 87,
}: {
  initial: CatalogPlan[];
  limitsById?: Record<string, LimitMap>;
  usdToInr?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [costTargetId, setCostTargetId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<CatalogPlan | null>(null);

  const { sortKey, sortDir, toggle, sorted } = useSorting<CatalogPlan>("sortOrder", "asc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((p) => {
    if (status === "active" && !p.isActive) return false;
    if (status === "inactive" && p.isActive) return false;
    if (q && !`${p.name} ${p.id} ${p.tagline ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = sorted(filtered, {
    name: (p) => p.name,
    monthlyPaise: (p) => p.monthlyPaise ?? Number.POSITIVE_INFINITY,
    annualDiscountPct: (p) => p.annualDiscountPct,
    outlets: (p) => limitsById[p.id]?.outlets ?? resolveLimits(p.id).outlets ?? 0,
    orders: (p) => limitsById[p.id]?.orders ?? 0,
    sortOrder: (p) => p.sortOrder,
    isActive: (p) => p.isActive,
  });
  const table = useResponsiveTableRows(rows, 10);

  const costPlans: CostPlan[] = initial.map((p) => ({
    id: p.id,
    name: p.name,
    monthlyPaise: p.monthlyPaise,
    limits: limitsById[p.id] ?? resolveLimits(p.id),
  }));

  async function toggleActive(p: CatalogPlan, active: boolean) {
    setBusy(true);
    try {
      await api(`/api/admin/plans/${p.id}`, "PATCH", { isActive: active });
      toast.success(`Plan ${p.name} ${active ? "activated" : "suspended"}`);
      setSuspendTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search plan name, id or tagline…"
          ariaLabel="Search plans"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No plans match</EmptyTitle>
                <EmptyDescription>Widen the search or clear the status filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortTh
                      label="Plan"
                      column="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Monthly"
                      column="monthlyPaise"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Annual"
                      column="annualDiscountPct"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Outlets"
                      column="outlets"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Orders / mo"
                      column="orders"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>
                    <SortTh
                      label="Status"
                      column="isActive"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((p) => {
                  const limits = limitsById[p.id] ?? resolveLimits(p.id);
                  return (
                    <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.tagline ?? p.id}</p>
                      </TableCell>
                      <TableCell className="font-medium">{inr(p.monthlyPaise)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.annualDiscountPct}% off
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {limits.outlets === null ? "Custom" : formatNumber(limits.outlets)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {limits.orders === null ? "Custom" : formatNumber(limits.orders)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {limits.objectStorage === null
                          ? "Custom"
                          : formatBytes(limits.objectStorage)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "outline" : "secondary"}>
                          {p.isActive ? "active" : "suspended"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu rowLabel={p.name}>
                          <DropdownMenuItem onClick={() => router.push(`/admin/billing/${p.id}`)}>
                            <Icons.edit className="mr-2 h-4 w-4" /> Edit plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCostTargetId(p.id)}>
                            <Icons.info className="mr-2 h-4 w-4" /> Cost &amp; margins
                          </DropdownMenuItem>
                          {p.isActive ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setSuspendTarget(p)}
                            >
                              <Icons.lock className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => void toggleActive(p, true)}>
                              <Icons.check className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {table.isDesktop && (
              <TablePagination
                page={table.page}
                totalPages={table.totalPages}
                total={table.total}
                onPageChange={table.setPage}
              />
            )}
          </CardContent>
        </Card>
      )}
      {!table.isDesktop && (
        <LoadMoreSentinel sentinelRef={table.sentinelRef} hasMore={table.hasMore} />
      )}

      <Dialog open={!!suspendTarget} onOpenChange={(v) => !v && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend “{suspendTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Blocked while any organisation sits on it. New signups stop seeing it immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !suspendTarget}
              onClick={() => suspendTarget && void toggleActive(suspendTarget, false)}
            >
              Confirm suspend
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
    </>
  );
}

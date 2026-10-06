"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import SyncStatus from "@/components/sync-status";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";
import { getQueryClient } from "@/lib/query-client";
import { formatINR } from "@/lib/money";
import { DISPATCH_CHANNELS, type OrderWithDerived } from "@/features/orders/api/types";
import { getOrderWithBilling, markDelivered } from "@/features/orders/api/service";
import { ordersQueryOptions } from "@/features/orders/api/queries";
import { collectPayment } from "@/features/payments/api/service";
import { Icons } from "@pixa/ui/icons";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import OrderStatusText from "@/features/orders/components/order-status";
import { cn } from "@pixa/ui/lib/utils";

const RIDER_KEY = "pixaRiderName";

function readRider(): string {
  try {
    return window.localStorage.getItem(RIDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function invalidateRider() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: ["orders"] });
  qc.invalidateQueries({ queryKey: ["payments"] });
}

/** One assigned order: order id first, then address, items, COD, handover. */
function RiderCard({ order }: { order: OrderWithDerived }) {
  const billingQuery = useQuery({
    queryKey: ["orders", "billing", order.id],
    queryFn: () => getOrderWithBilling(order.id),
  });
  const deliveredMut = useMutation({
    mutationFn: () => markDelivered(order.id),
    onSuccess: () => {
      invalidateRider();
      toast.success(`${order.order_number} delivered`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const collectMut = useMutation({
    mutationFn: (amount_paise: number) =>
      collectPayment({ order_id: order.id, amount_paise, method: "cash" }),
    onSuccess: () => {
      invalidateRider();
      toast.success(`COD collected for ${order.order_number}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = billingQuery.data
    ? Math.max(0, billingQuery.data.order.grand_total_paise - billingQuery.data.paid_paise)
    : 0;

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold">{order.order_number}</span>
        <OrderStatusText status={order.status} />
        <span className="ml-auto text-sm font-bold">{formatINR(order.grand_total_paise)}</span>
      </div>
      <p className="mt-1 text-sm">
        {order.customer_name ?? "Customer"}
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="ml-2 text-primary underline">
            Call {order.customer_phone}
          </a>
        )}
      </p>
      {order.delivery_address_snapshot && (
        <p className="mt-0.5 text-xs text-muted-foreground">{order.delivery_address_snapshot}</p>
      )}
      <ul className="mt-1 text-xs text-muted-foreground">
        {order.items.map((i) => (
          <li key={i.id}>
            {i.qty} × {i.item_name_snapshot}
            {i.variant_name_snapshot ? ` (${i.variant_name_snapshot})` : ""}
          </li>
        ))}
      </ul>
      <div className="mt-1 text-xs text-muted-foreground">
        {billingQuery.isPending
          ? "Balance…"
          : balance > 0
            ? `COD due ${formatINR(balance)}`
            : "Settled"}
      </div>
      {order.status === "OUT_FOR_DELIVERY" && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={deliveredMut.isPending}
            onClick={() => deliveredMut.mutate()}
          >
            <Icons.receipt className="mr-1 size-4" aria-hidden />
            {deliveredMut.isPending ? "Saving…" : "Mark delivered"}
          </Button>
          {balance > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={collectMut.isPending}
              onClick={() => collectMut.mutate(balance)}
            >
              {collectMut.isPending ? "Collecting…" : `Collect ${formatINR(balance)}`}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export default function RiderShell() {
  useCrossTabSync();
  const [rider, setRider] = useState(readRider);
  const [draft, setDraft] = useState(rider);
  const ordersQuery = useQuery({ ...ordersQueryOptions(), refetchInterval: 5000 });

  const knownRiders = Array.from(
    new Set(
      (ordersQuery.data ?? [])
        .map((o) => o.rider_name?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ).sort();

  const mine = (ordersQuery.data ?? []).filter(
    (o) =>
      !o.deleted_at &&
      (DISPATCH_CHANNELS as string[]).includes(o.channel) &&
      (o.status === "OUT_FOR_DELIVERY" || o.status === "DELIVERED") &&
      o.rider_name?.trim().toLowerCase() === rider.trim().toLowerCase(),
  );

  const saveRider = () => {
    const name = draft.trim();
    if (!name) {
      toast.error("Enter your name");
      return;
    }
    try {
      window.localStorage.setItem(RIDER_KEY, name);
    } catch {}
    setRider(name);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <Icons.user className="size-5 text-primary" aria-hidden />
          <span className="leading-tight">
            <span className="block text-sm font-bold">Rider{rider ? ` — ${rider}` : ""}</span>
            <span className="block text-[11px] text-muted-foreground">My assigned deliveries</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <SyncStatus />
          <ThemeModeToggle />
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {!rider ? (
          <div className="mx-auto grid max-w-sm gap-3 rounded-lg border p-4">
            <h1 className="text-base font-semibold">Who&apos;s riding?</h1>
            <p className="text-xs text-muted-foreground">
              Pick your name to see only your assigned orders.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="rider-name">Rider name</Label>
              <Input
                id="rider-name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your name"
                list="known-riders"
                autoComplete="off"
              />
              <datalist id="known-riders">
                {knownRiders.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <Button onClick={saveRider} className="w-full">
              Show my runs
            </Button>
          </div>
        ) : ordersQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading runs…</p>
        ) : ordersQuery.isError ? (
          <p className="text-xs text-destructive">
            Couldn&apos;t load runs.{" "}
            <button type="button" className="underline" onClick={() => ordersQuery.refetch()}>
              Retry
            </button>
          </p>
        ) : mine.length === 0 ? (
          <div className="grid gap-3 rounded-lg border border-dashed p-6 text-center">
            <p className="text-xs text-muted-foreground">No runs assigned to {rider} right now.</p>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mx-auto")}
              onClick={() => {
                try {
                  window.localStorage.removeItem(RIDER_KEY);
                } catch {}
                setRider("");
                setDraft("");
              }}
            >
              Switch rider
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {mine.length} run{mine.length === 1 ? "" : "s"} · {rider}
              </p>
              <button
                type="button"
                className="ml-auto text-xs text-primary underline"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(RIDER_KEY);
                  } catch {}
                  setRider("");
                  setDraft("");
                }}
              >
                Switch rider
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((o) => (
                <RiderCard key={o.id} order={o} />
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

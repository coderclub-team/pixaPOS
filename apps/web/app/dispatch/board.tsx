"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import SyncStatus from "@/components/sync-status";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";
import { getQueryClient } from "@/lib/query-client";
import { formatINR } from "@/lib/money";
import { useAppForm } from "@/lib/form";
import { DISPATCH_CHANNELS, type OrderWithDerived } from "@/features/orders/api/types";
import { assignRider, dispatchOrder, completeOrder } from "@/features/orders/api/service";
import { ordersQueryOptions } from "@/features/orders/api/queries";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import OrderStatusText from "@/features/orders/components/order-status";
import { cn } from "@pixa/ui/lib/utils";

function invalidateDispatch() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: ["orders"] });
}

function ageMinutes(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Assign rider + confirm drop address, then dispatch in one tap. */
function DispatchDialog({
  order,
  knownRiders,
  open,
  onOpenChange,
}: {
  order: OrderWithDerived;
  knownRiders: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatchMut = useMutation({
    mutationFn: async (value: { rider_name: string; delivery_address: string }) => {
      if (value.delivery_address !== (order.delivery_address_snapshot ?? "")) {
        const { setDeliveryAddress } = await import("@/features/orders/api/service");
        await setDeliveryAddress(order.id, { delivery_address: value.delivery_address });
      }
      if (value.rider_name !== (order.rider_name ?? "")) {
        await assignRider(order.id, { rider_name: value.rider_name });
      }
      await dispatchOrder(order.id);
    },
    onSuccess: () => {
      invalidateDispatch();
      toast.success(`${order.order_number} dispatched`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      rider_name: order.rider_name ?? "",
      delivery_address: order.delivery_address_snapshot ?? "",
    },
    onSubmit: async ({ value }) => {
      if (!value.rider_name.trim()) {
        toast.error("Rider name is required");
        return;
      }
      if (!value.delivery_address.trim()) {
        toast.error("Drop address is required");
        return;
      }
      await dispatchMut.mutateAsync({
        rider_name: value.rider_name.trim(),
        delivery_address: value.delivery_address.trim(),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Dispatch {order.order_number}</DialogTitle>
          <DialogDescription>
            {order.customer_name ?? "Customer"}
            {order.customer_phone ? ` · ${order.customer_phone}` : ""} ·{" "}
            {formatINR(order.grand_total_paise)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="grid gap-4"
        >
          <form.AppField
            name="rider_name"
            children={(field) => (
              <field.TextField
                label="Rider"
                required
                placeholder="Rider name"
                list="dispatch-riders"
                autoComplete="off"
              />
            )}
          />
          <datalist id="dispatch-riders">
            {knownRiders.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <form.AppField
            name="delivery_address"
            children={(field) => (
              <field.TextField label="Drop address" required placeholder="Flat, street, landmark" />
            )}
          />
          <Button type="submit" disabled={dispatchMut.isPending} className="w-full">
            {dispatchMut.isPending ? "Dispatching…" : "Assign & dispatch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DispatchCard({
  order,
  onDispatch,
}: {
  order: OrderWithDerived;
  onDispatch: (o: OrderWithDerived) => void;
}) {
  const completeMut = useMutation({
    mutationFn: () => completeOrder(order.id),
    onSuccess: () => {
      invalidateDispatch();
      toast.success(`${order.order_number} completed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const age = ageMinutes(
    order.status === "DELIVERED" && order.delivered_at ? order.delivered_at : order.updated_at,
  );

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{order.order_number}</span>
        <OrderStatusText status={order.status} />
        <span className="ml-auto text-xs text-muted-foreground">{age}m</span>
      </div>
      <p className="mt-1 truncate text-sm">
        {order.customer_name ?? "Customer"}
        {order.customer_phone ? ` · ${order.customer_phone}` : ""}
      </p>
      {order.delivery_address_snapshot && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {order.delivery_address_snapshot}
        </p>
      )}
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {order.items.reduce((s, i) => s + i.qty, 0)} items · {formatINR(order.grand_total_paise)}
        </span>
        {order.rider_name && <Badge variant="secondary">{order.rider_name}</Badge>}
      </div>
      <div className="mt-2 flex gap-2">
        {order.status === "READY" && (
          <Button size="sm" className="flex-1" onClick={() => onDispatch(order)}>
            <Icons.send className="mr-1 size-4" aria-hidden />
            Dispatch
          </Button>
        )}
        {order.status === "DELIVERED" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={completeMut.isPending}
            onClick={() => completeMut.mutate()}
          >
            {completeMut.isPending ? "Completing…" : "Complete"}
          </Button>
        )}
        <Link
          href={`/dashboard/orders/${order.id}`}
          aria-label={`Open ${order.order_number}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Bill
        </Link>
      </div>
    </li>
  );
}

const COLUMNS = [
  { status: "READY", title: "To dispatch", hint: "Packed & ready" },
  { status: "OUT_FOR_DELIVERY", title: "Out for delivery", hint: "With riders" },
  { status: "DELIVERED", title: "Delivered", hint: "Confirm & complete" },
] as const;

export default function DispatchBoard() {
  useCrossTabSync();
  const [dispatchTarget, setDispatchTarget] = useState<OrderWithDerived | null>(null);
  const ordersQuery = useQuery({ ...ordersQueryOptions(), refetchInterval: 5000 });

  const dispatchOrders = (ordersQuery.data ?? []).filter(
    (o) =>
      !o.deleted_at &&
      (DISPATCH_CHANNELS as string[]).includes(o.channel) &&
      ["READY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status),
  );
  const knownRiders = Array.from(
    new Set(dispatchOrders.map((o) => o.rider_name?.trim()).filter((n): n is string => Boolean(n))),
  ).sort();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <Icons.send className="size-5 text-primary" aria-hidden />
          <span className="leading-tight">
            <span className="block text-sm font-bold">Dispatch Console</span>
            <span className="block text-[11px] text-muted-foreground">
              Pack, assign riders, send out
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Link
            href="/dispatch/run"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <Icons.package className="mr-1 size-4" aria-hidden />
            Run sheet
          </Link>
          <SyncStatus />
          <ThemeModeToggle />
        </span>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = dispatchOrders.filter((o) => o.status === col.status);
          return (
            <section
              key={col.status}
              aria-label={col.title}
              className="flex min-h-0 flex-col gap-2"
            >
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {col.title}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    cards.length > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {cards.length}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">{col.hint}</span>
              </h2>
              {ordersQuery.isPending ? (
                <p className="text-xs text-muted-foreground">Loading dispatch queue…</p>
              ) : ordersQuery.isError ? (
                <p className="text-xs text-destructive">
                  Couldn&apos;t load orders.{" "}
                  <button type="button" className="underline" onClick={() => ordersQuery.refetch()}>
                    Retry
                  </button>
                </p>
              ) : cards.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nothing {col.title.toLowerCase()}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {cards.map((o) => (
                    <DispatchCard key={o.id} order={o} onDispatch={setDispatchTarget} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </main>
      {dispatchTarget && (
        <DispatchDialog
          order={dispatchTarget}
          knownRiders={knownRiders}
          open
          onOpenChange={(v) => {
            if (!v) setDispatchTarget(null);
          }}
        />
      )}
    </div>
  );
}

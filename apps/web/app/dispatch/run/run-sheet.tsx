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
import { getOrderWithBilling, markDelivered } from "@/features/orders/api/service";
import { ordersQueryOptions } from "@/features/orders/api/queries";
import { collectPayment } from "@/features/payments/api/service";
import type { PaymentMethod } from "@/features/payments/api/types";
import { Icons } from "@pixa/ui/icons";
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

const COD_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "debit_card", label: "Card" },
];

function invalidateRun() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: ["orders"] });
  qc.invalidateQueries({ queryKey: ["payments"] });
}

/** Collect the door balance (COD) against one order. */
function CollectDialog({
  order,
  balance,
  open,
  onOpenChange,
}: {
  order: OrderWithDerived;
  balance: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const collectMut = useMutation({
    mutationFn: (value: { amount_paise: number; method: PaymentMethod }) =>
      collectPayment({
        order_id: order.id,
        amount_paise: value.amount_paise,
        method: value.method,
      }),
    onSuccess: () => {
      invalidateRun();
      toast.success(`Collected for ${order.order_number}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: { amount: (balance / 100).toFixed(2), method: "cash" as PaymentMethod },
    onSubmit: async ({ value }) => {
      const amount_paise = Math.round(Number(value.amount) * 100);
      if (!Number.isFinite(amount_paise) || amount_paise <= 0) {
        toast.error("Enter a valid amount");
        return;
      }
      await collectMut.mutateAsync({ amount_paise, method: value.method });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect COD — {order.order_number}</DialogTitle>
          <DialogDescription>Door balance {formatINR(balance)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="grid gap-4"
        >
          <form.AppField
            name="amount"
            children={(field) => <field.TextField label="Amount (₹)" required placeholder="0.00" />}
          />
          <form.AppField
            name="method"
            children={(field) => (
              <field.SelectField
                label="Method"
                required
                options={COD_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              />
            )}
          />
          <Button type="submit" disabled={collectMut.isPending} className="w-full">
            {collectMut.isPending ? "Collecting…" : "Collect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunCard({ order }: { order: OrderWithDerived }) {
  const [collectOpen, setCollectOpen] = useState(false);
  const billingQuery = useQuery({
    queryKey: ["orders", "billing", order.id],
    queryFn: () => getOrderWithBilling(order.id),
  });
  const deliveredMut = useMutation({
    mutationFn: () => markDelivered(order.id),
    onSuccess: () => {
      invalidateRun();
      toast.success(`${order.order_number} delivered`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = billingQuery.data
    ? Math.max(0, billingQuery.data.order.grand_total_paise - billingQuery.data.paid_paise)
    : 0;

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{order.order_number}</span>
        <OrderStatusText status={order.status} />
        <span className="ml-auto text-sm font-bold">{formatINR(order.grand_total_paise)}</span>
      </div>
      <p className="mt-1 text-sm">
        {order.customer_name ?? "Customer"}
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="ml-2 text-primary underline">
            {order.customer_phone}
          </a>
        )}
      </p>
      {order.delivery_address_snapshot && (
        <p className="mt-0.5 text-xs text-muted-foreground">{order.delivery_address_snapshot}</p>
      )}
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {order.rider_name ? (
          <span>Rider: {order.rider_name}</span>
        ) : (
          <span className="text-amber-600">No rider assigned</span>
        )}
        <span className="ml-auto">
          {billingQuery.isPending
            ? "Balance…"
            : balance > 0
              ? `COD ${formatINR(balance)}`
              : "Settled"}
        </span>
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
              onClick={() => setCollectOpen(true)}
            >
              Collect COD
            </Button>
          )}
        </div>
      )}
      {collectOpen && (
        <CollectDialog order={order} balance={balance} open onOpenChange={setCollectOpen} />
      )}
    </li>
  );
}

export default function RunSheet() {
  useCrossTabSync();
  const ordersQuery = useQuery({ ...ordersQueryOptions(), refetchInterval: 5000 });

  const runs = (ordersQuery.data ?? []).filter(
    (o) =>
      !o.deleted_at &&
      (DISPATCH_CHANNELS as string[]).includes(o.channel) &&
      (o.status === "OUT_FOR_DELIVERY" || o.status === "DELIVERED"),
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <Icons.package className="size-5 text-primary" aria-hidden />
          <span className="leading-tight">
            <span className="block text-sm font-bold">Delivery Run Sheet</span>
            <span className="block text-[11px] text-muted-foreground">
              Addresses, COD, handover proof
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Link href="/dispatch" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            Dispatch board
          </Link>
          <SyncStatus />
          <ThemeModeToggle />
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {ordersQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading runs…</p>
        ) : ordersQuery.isError ? (
          <p className="text-xs text-destructive">
            Couldn&apos;t load runs.{" "}
            <button type="button" className="underline" onClick={() => ordersQuery.refetch()}>
              Retry
            </button>
          </p>
        ) : runs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No runs out or delivered yet — dispatch orders from the board.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((o) => (
              <RunCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

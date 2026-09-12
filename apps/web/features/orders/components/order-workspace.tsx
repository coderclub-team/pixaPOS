"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { kotsByOrderQueryOptions, kitchenKeys } from "@/features/kitchen/api/queries";
import {
  paymentsByOrderQueryOptions,
  refundsByOrderQueryOptions,
} from "@/features/payments/api/queries";
import { cancelOrder } from "@/features/orders/api/service";
import CustomerLinkBlock from "@/features/customers/components/customer-link-block";
import {
  increaseKOTLineQty,
  voidKOT,
  voidKOTLine,
} from "@/features/kitchen/api/service";
import type { KitchenTicketWithDerived } from "@/features/kitchen/api/types";
import OrderStatusText from "./order-status";
import KotItemDialog from "./kot-item-dialog";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

export default function OrderWorkspacePage({ orderId }: { orderId: string }) {
  const { data: order, isPending } = useQuery(orderQueryOptions(orderId));
  const { data: kots } = useQuery(kotsByOrderQueryOptions(orderId));
  const [addOpen, setAddOpen] = useState(false);

  if (isPending) {
    return (
      <PageContainer pageTitle="Order" isLoading>
        <div />
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer pageTitle="Order not found">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This order does not exist.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle={`Order ${order.order_number}`}
      pageDescription={`${order.channel.replace("_", " ")} · ${order.status.toLowerCase().replace("_", " ")} · ${formatINR(order.grand_total_paise)}`}
      pageHeaderAction={
        <Button
          className="text-xs md:text-sm"
          onClick={() => setAddOpen(true)}
          disabled={order.status === "COMPLETED" || order.status === "CANCELLED"}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Items
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <OrderInfoCard orderId={order.id} />
          <KotCards orderId={order.id} kots={kots ?? []} />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <BillCard orderId={order.id} />
        </div>
      </div>

      <KotItemDialog orderId={order.id} open={addOpen} onOpenChange={setAddOpen} />
    </PageContainer>
  );
}

function invalidate(orderId: string) {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  qc.invalidateQueries({ queryKey: orderKeys.all });
  qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
  qc.invalidateQueries({ queryKey: kitchenKeys.all });
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

function OrderInfoCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  if (!order) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Order details</span>
          <OrderStatusText status={order.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <InfoRow label="Order no.">
          <span className="font-medium">{order.order_number}</span>
        </InfoRow>
        <InfoRow label="Channel">
          <span className="capitalize">{order.channel.replace("_", " ")}</span>
        </InfoRow>
        {order.table_number_snapshot && (
          <InfoRow label="Table">
            <span>Table {order.table_number_snapshot}</span>
          </InfoRow>
        )}
        <div className="py-1">
          <CustomerLinkBlock orderId={order.id} />
        </div>
        {order.external_ref && (
          <InfoRow label="Aggregator ref">
            <span className="font-mono text-xs">{order.external_ref}</span>
          </InfoRow>
        )}
        <InfoRow label="Placed">
          <span className="text-muted-foreground">
            {new Date(order.created_at).toLocaleString()}
          </span>
        </InfoRow>
        <InfoRow label="Items">
          <span>
            {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.kot_count} KOT
            {order.kot_count === 1 ? "" : "s"}
          </span>
        </InfoRow>
      </CardContent>
    </Card>
  );
}

function KotCards({ orderId, kots }: { orderId: string; kots: KitchenTicketWithDerived[] }) {
  const [voidKotId, setVoidKotId] = useState<string | null>(null);
  const [voidLine, setVoidLine] = useState<{ kotId: string; lineId: string; max: number; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState(1);

  const voidKotMut = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => voidKOT(id, { reason: r }),
    onSuccess: () => {
      invalidate(orderId);
      toast.success("KOT voided and recorded");
      setVoidKotId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const voidLineMut = useMutation({
    mutationFn: ({ kotId, lineId, q, r }: { kotId: string; lineId: string; q: number; r: string }) =>
      voidKOTLine(kotId, lineId, { qty: q, reason: r }),
    onSuccess: () => {
      invalidate(orderId);
      toast.success("Item void recorded on KOT");
      setVoidLine(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const plusMut = useMutation({
    mutationFn: ({ kotId, lineId, extra }: { kotId: string; lineId: string; extra?: number }) =>
      increaseKOTLineQty(kotId, lineId, { extra: extra ?? 1 }),
    onSuccess: () => invalidate(orderId),
    onError: (e: Error) => toast.error(e.message),
  });

  const lineEditable = (kot: KitchenTicketWithDerived, l: { status: string }) =>
    kot.status !== "SERVED" &&
    kot.status !== "CANCELLED" &&
    (l.status === "PENDING" || l.status === "PREPARING");

  if (kots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kitchen tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing fired yet. Use Add Items — each add creates a new KOT.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {kots.map((kot) => (
        <Card key={kot.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span>
                KOT #{kot.kot_number}{" "}
                <span className="ml-1 text-xs font-normal capitalize text-muted-foreground">
                  {kot.status.toLowerCase()}
                </span>
              </span>
              {kot.status !== "CANCELLED" && kot.status !== "SERVED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setReason("");
                    setVoidKotId(kot.id);
                  }}
                >
                  <Icons.trash className="mr-1 h-4 w-4" /> Void KOT
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {kot.lines.map((l) => {
              const remaining = l.qty - l.voided_qty;
              return (
                <div
                  key={l.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm",
                    l.status === "VOIDED" && "bg-destructive/10 text-destructive line-through",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.item_name_snapshot}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.variant_name_snapshot ? `${l.variant_name_snapshot} · ` : ""}
                      {l.modifiers_snapshot.join(", ")}
                      {l.instructions ? ` · “${l.instructions}”` : ""}
                      {l.voided_qty > 0 && l.status !== "VOIDED" && ` · (${l.voided_qty} voided)`}
                    </p>
                  </div>
                  {lineEditable(kot, l) ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        title="Reduce (records cancellation)"
                        aria-label={`Reduce ${l.item_name_snapshot}`}
                        disabled={voidLineMut.isPending}
                        onClick={() => {
                          setReason("");
                          setQty(1);
                          setVoidLine({ kotId: kot.id, lineId: l.id, max: remaining, name: l.item_name_snapshot });
                        }}
                      >
                        <Icons.minus className="size-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={remaining}
                        aria-label={`${l.item_name_snapshot} quantity`}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isInteger(next) || next < 1 || next === remaining) return;
                          if (next > remaining) {
                            if (next - remaining > 50) {
                              toast.error("Add at most 50 at once");
                              return;
                            }
                            plusMut.mutate({ kotId: kot.id, lineId: l.id, extra: next - remaining });
                            return;
                          }
                          setReason("");
                          setQty(remaining - next);
                          setVoidLine({ kotId: kot.id, lineId: l.id, max: remaining, name: l.item_name_snapshot });
                        }}
                        className="h-8 w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        title="Add one more"
                        aria-label={`Add one more ${l.item_name_snapshot}`}
                        disabled={plusMut.isPending}
                        onClick={() => plusMut.mutate({ kotId: kot.id, lineId: l.id })}
                      >
                        <Icons.add className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        title="Remove item (records cancellation)"
                        aria-label={`Remove ${l.item_name_snapshot}`}
                        disabled={voidLineMut.isPending}
                        onClick={() => {
                          setReason("");
                          setQty(remaining);
                          setVoidLine({ kotId: kot.id, lineId: l.id, max: remaining, name: l.item_name_snapshot });
                        }}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-sm font-medium">
                      {remaining > 0 ? `${remaining}×` : ""}
                      <span className="ml-2 text-[10px] font-normal capitalize text-muted-foreground">
                        {l.status.toLowerCase()}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
            {kot.voids.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {kot.voids.map((v) => (
                  <p key={v.id} className="text-xs text-destructive">
                    Voided {v.qty}× — {v.reason}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={voidKotId != null} onOpenChange={(o) => !o && setVoidKotId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this KOT?</DialogTitle>
            <DialogDescription>
              The void is recorded on the KOT with your reason — kitchen-consumed items flow to waste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input placeholder="Wrong table, duplicate fire…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidKotId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voidKotMut.isPending || !reason.trim()}
              onClick={() => voidKotId && voidKotMut.mutate({ id: voidKotId, r: reason.trim() })}
            >
              Void KOT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={voidLine != null} onOpenChange={(o) => !o && setVoidLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void {voidLine?.name}?</DialogTitle>
            <DialogDescription>Partial voids allowed. The deletion is recorded on the KOT.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qty (max {voidLine?.max})</Label>
              <Input
                type="number"
                min={1}
                max={voidLine?.max ?? 1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input placeholder="Customer changed mind…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidLine(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voidLineMut.isPending || !reason.trim() || !voidLine || qty < 1 || qty > voidLine.max}
              onClick={() =>
                voidLine && voidLineMut.mutate({ kotId: voidLine.kotId, lineId: voidLine.lineId, q: qty, r: reason.trim() })
              }
            >
              Void item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BillCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: payments } = useQuery(paymentsByOrderQueryOptions(orderId));
  const { data: refunds } = useQuery(refundsByOrderQueryOptions(orderId));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMut = useMutation({
    mutationFn: (r: string) => cancelOrder(orderId, { reason: r }),
    onSuccess: () => {
      invalidate(orderId);
      toast.success("Order cancelled");
      setCancelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return null;
  const paidTotal =
    (payments ?? []).filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount_paise, 0) -
    (refunds ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const balance = Math.max(0, order.grand_total_paise - paidTotal);
  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bill</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatINR(order.subtotal_paise)}</span>
        </div>
        {(order.discount_paise || order.discount_percent) && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Discount{order.discount_reason ? ` · ${order.discount_reason}` : ""}
            </span>
            <span>−{formatINR(Math.max(0, order.total_paise - order.grand_total_paise))}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax (GST)</span>
          <span>{formatINR(order.tax_paise)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatINR(order.grand_total_paise)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Paid {formatINR(paidTotal)}</span>
          <span>Balance {formatINR(balance)}</span>
        </div>
        {!terminal && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setCancelReason("");
              setCancelOpen(true);
            }}
          >
            Cancel order
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Checkout (tender, splits, refunds) lives in the order terminal bill panel.
        </p>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel order {order.order_number}?</DialogTitle>
              <DialogDescription>
                {["PREPARING", "READY", "SERVED"].includes(order.status)
                  ? "This order has fired KOTs — cancellation is authorized and audited."
                  : "The order and its unfired lines are removed."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input placeholder="Customer walked out…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Keep order
              </Button>
              <Button
                variant="destructive"
                disabled={cancelMut.isPending || !cancelReason.trim()}
                onClick={() => cancelMut.mutate(cancelReason.trim())}
              >
                Cancel order
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

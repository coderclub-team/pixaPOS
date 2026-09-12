"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
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
  cancelOrder,
  confirmOrder,
  linkCustomer,
  removeDraftItem,
  updateDraftItemQty,
} from "@/features/orders/api/service";
import CustomerLinkBlock from "@/features/customers/components/customer-link-block";
import { fireKOT, voidKOT, voidKOTLine } from "@/features/kitchen/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

export default function OrderWorkspacePage({ orderId }: { orderId: string }) {
  const { data: order, isPending } = useQuery(orderQueryOptions(orderId));
  const { data: kots } = useQuery(kotsByOrderQueryOptions(orderId));

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
      pageDescription={`${order.channel.replace("_", " ")} · ${order.status.toLowerCase().replace("_", " ")} · ${formatINR(order.total_paise)}`}
      pageHeaderAction={
        <Link
          href={`/dashboard/orders/${order.id}/add`}
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Items
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <DraftItemsCard orderId={order.id} />
          <FiredKOTsCard orderId={order.id} kots={kots ?? []} />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <SummaryCard orderId={order.id} />
        </div>
      </div>
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

function DraftItemsCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const router = useRouter();
  const draft = order?.items.filter((i) => !i.kot_id) ?? [];

  const qtyMut = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      updateDraftItemQty(orderId, lineId, qty),
    onSuccess: () => invalidate(orderId),
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (lineId: string) => removeDraftItem(orderId, lineId),
    onSuccess: () => invalidate(orderId),
    onError: (e: Error) => toast.error(e.message),
  });
  const fireMut = useMutation({
    mutationFn: () => fireKOT(orderId),
    onSuccess: (kot) => {
      invalidate(orderId);
      toast.success(`KOT #${kot.kot_number} fired to kitchen`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft KOT — new items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {draft.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No new items. Add items to build the next kitchen ticket.
          </p>
        ) : (
          draft.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.item_name_snapshot}</p>
                <p className="text-xs text-muted-foreground">
                  {l.variant_name_snapshot ? `${l.variant_name_snapshot} · ` : ""}
                  {l.modifiers.map((m) => m.name_snapshot).join(", ")}
                  {l.instructions ? ` · “${l.instructions}”` : ""} · {formatINR(l.line_total_paise)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={l.qty <= 1 || qtyMut.isPending}
                  onClick={() => qtyMut.mutate({ lineId: l.id, qty: l.qty - 1 })}
                >
                  <Icons.minus className="size-4" />
                </Button>
                <span className="w-6 text-center font-medium">{l.qty}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={qtyMut.isPending}
                  onClick={() => qtyMut.mutate({ lineId: l.id, qty: l.qty + 1 })}
                >
                  <Icons.add className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={removeMut.isPending}
                  onClick={() => removeMut.mutate(l.id)}
                >
                  <Icons.trash className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => router.push(`/dashboard/orders/${orderId}/add`)}>
            <Icons.add className="mr-2 size-4" /> Add items
          </Button>
          <Button className="flex-1" disabled={draft.length === 0 || fireMut.isPending} onClick={() => fireMut.mutate()}>
            {fireMut.isPending ? "Firing…" : "Fire to kitchen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FiredKOTsCard({ orderId, kots }: { orderId: string; kots: any[] }) {
  const [voidKotId, setVoidKotId] = useState<string | null>(null);
  const [voidLine, setVoidLine] = useState<{ kotId: string; lineId: string; max: number } | null>(null);
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

  if (kots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kitchen tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing fired yet. Fired tickets appear here with per-item void.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kitchen tickets ({kots.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {kots.map((kot) => (
          <div key={kot.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">
                KOT #{kot.kot_number}{" "}
                <span className="ml-1 text-xs capitalize text-muted-foreground">{kot.status.toLowerCase()}</span>
              </p>
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
            </div>
            <div className="space-y-1">
              {kot.lines.map((l: any) => (
                <div
                  key={l.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                    l.status === "VOIDED" ? "bg-destructive/10 text-destructive line-through" : ""
                  }`}
                >
                  <span>
                    {l.qty - l.voided_qty > 0 ? `${l.qty - l.voided_qty}× ` : ""}
                    {l.item_name_snapshot}
                    {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
                    {l.voided_qty > 0 && l.status !== "VOIDED" && (
                      <span className="ml-1 text-xs">({l.voided_qty} voided)</span>
                    )}
                  </span>
                  {l.status !== "VOIDED" && l.status !== "SERVED" && kot.status !== "CANCELLED" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Void item"
                      onClick={() => {
                        setReason("");
                        setQty(l.qty - l.voided_qty);
                        setVoidLine({ kotId: kot.id, lineId: l.id, max: l.qty - l.voided_qty });
                      }}
                    >
                      <Icons.close className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {kot.voids.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {kot.voids.map((v: any) => (
                  <p key={v.id} className="text-xs text-destructive">
                    Voided {v.qty}× — {v.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
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
              <DialogTitle>Void item from KOT?</DialogTitle>
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
      </CardContent>
    </Card>
  );
}

function SummaryCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const confirmMut = useMutation({
    mutationFn: () => confirmOrder(orderId),
    onSuccess: () => {
      invalidate(orderId);
      toast.success("Order confirmed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
  const editable = order.status === "DRAFT" || order.status === "CONFIRMED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bill summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Channel</span>
          <span className="capitalize">{order.channel.replace("_", " ")}</span>
        </div>
        {order.table_number_snapshot && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Table</span>
            <span>{order.table_number_snapshot}</span>
          </div>
        )}
        <CustomerLinkBlock orderId={order.id} />
        {order.external_ref && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aggregator ref</span>
            <span className="font-mono text-xs">{order.external_ref}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatINR(order.subtotal_paise)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax (GST)</span>
          <span>{formatINR(order.tax_paise)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatINR(order.total_paise)}</span>
        </div>
        <div className="flex gap-2 pt-2">
          {order.status === "DRAFT" && (
            <Button className="flex-1" disabled={confirmMut.isPending || order.items.length === 0} onClick={() => confirmMut.mutate()}>
              Confirm order
            </Button>
          )}
          {editable && (
            <Button
              variant="outline"
              className={order.status === "DRAFT" ? "" : "flex-1"}
              onClick={() => {
                setCancelReason("");
                setCancelOpen(true);
              }}
            >
              Cancel order
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Payment and bill settlement arrive in Phase 2 — totals above are already GST-split per item.
        </p>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel order {order.order_number}?</DialogTitle>
              <DialogDescription>
                {["PREPARING", "READY", "SERVED"].includes(order.status)
                  ? "This order has fired KOTs — cancellation is authorized and audited."
                  : "Draft items are simply removed."}
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

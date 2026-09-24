"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { formatAge } from "@/lib/utils";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { kotsByOrderQueryOptions, kitchenKeys } from "@/features/kitchen/api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { tableQueryOptions } from "@/features/table/api/queries";
import BillCustomerTab from "@/features/customers/components/bill-customer-tab";
import TableStrip from "@/features/table/components/table-strip";
import TableOpsDialog from "@/features/table/components/table-ops-dialog";
import CheckoutDialog from "./checkout-dialog";
import ReturnDialog, { type ReturnTarget } from "./return-dialog";
import ReprintDialog from "@/features/print-studio/components/reprint-dialog";
import BillPrintPreview, {
  useBillPreviewDoc,
} from "@/features/print-studio/components/bill-print-preview";
import ReceiptPreview from "@/features/print-studio/components/receipt-preview";
import AmountPad from "./amount-pad";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pixa/ui/base-ui/tabs";
import {
  paymentsByOrderQueryOptions,
  paymentKeys,
  refundsByOrderQueryOptions,
} from "@/features/payments/api/queries";
import {
  addOrderItem,
  cancelOrder,
  computeSplits,
  clearSplit,
  removeDraftItem,
  setDiscount,
  updateDraftItemQty,
} from "@/features/orders/api/service";
import { collectPayment } from "@/features/payments/api/service";
import { fireKOT, voidKOTLine } from "@/features/kitchen/api/service";
import type { PaymentMethod, Payment } from "@/features/payments/api/types";
import type { KitchenTicketWithDerived } from "@/features/kitchen/api/types";
import { toast } from "sonner";

const LINE_STATUS_DOT: Record<string, string> = {
  PENDING: "bg-slate-400",
  ACCEPTED: "bg-sky-500",
  PREPARING: "bg-amber-500 animate-pulse",
  READY: "bg-green-500",
  SERVED: "bg-emerald-700",
  VOIDED: "bg-red-500",
};

const PAYMENT_STAMP: Record<string, { label: string; className: string }> = {
  UNPAID: { label: "Unpaid", className: "border-slate-500 text-slate-600" },
  PARTIAL: { label: "Partial", className: "border-amber-500 text-amber-600" },
  PAID: { label: "Paid", className: "border-green-500 text-green-600" },
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "debit_card", label: "Debit" },
  { value: "credit_card", label: "Credit" },
  { value: "bank_transfer", label: "Bank" },
  { value: "wallet", label: "Wallet" },
];

/**
 * Collapsed KOT list with per-line kitchen status.
 * Editable: + adds qty (kitchen makes more), −/trash reduce with a reason and
 * the reduction is recorded as a cancellation on the KOT.
 */
export function KOTAccordion({
  kots,
  orderId,
  editable,
}: {
  kots: KitchenTicketWithDerived[];
  orderId: string;
  editable?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [openId, setOpenId] = useState<string | null>(kots[0]?.id ?? null);
  // Arrival flash: when a new KOT lands, auto-expand it and pulse once.
  const [flashId, setFlashId] = useState<string | null>(null);
  const seenIds = useRef(new Set(kots.map((k) => k.id)));
  useEffect(() => {
    const fresh = kots.find((k) => !seenIds.current.has(k.id));
    seenIds.current = new Set(kots.map((k) => k.id));
    if (fresh) {
      setOpenId(fresh.id);
      setFlashId(fresh.id);
      const t = window.setTimeout(() => setFlashId((f) => (f === fresh.id ? null : f)), 1600);
      return () => window.clearTimeout(t);
    }
  }, [kots]);
  const [reduceTarget, setReduceTarget] = useState<{
    kotId: string;
    lineId: string;
    max: number;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [reduceQty, setReduceQty] = useState(1);
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null);
  // Returns post-date voids: only on a served bill with returnable qty left.
  const lineReturnable = (
    kot: KitchenTicketWithDerived,
    l: { qty: number; voided_qty: number; returned_qty?: number },
  ) =>
    !!editable &&
    kot.status !== "CANCELLED" &&
    (order?.status === "SERVED" || order?.status === "COMPLETED") &&
    l.qty - l.voided_qty - (l.returned_qty ?? 0) > 0;

  // Plus on a fired line adds the same item as a NEW unfired line — it will
  // fire as a fresh KOT, never mutate the fired ticket.
  const plusMut = useMutation({
    mutationFn: (orderLineId: string) => {
      const ol = order?.items.find((i) => i.id === orderLineId);
      if (!ol) throw new Error("Order line not found");
      return addOrderItem(orderId, {
        menu_item_id: ol.menu_item_id,
        variant_id: ol.variant_id,
        modifier_ids: ol.modifiers.map((m) => m.modifier_id),
        qty: 1,
        instructions: ol.instructions,
      });
    },
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Added — fire to kitchen for a new KOT");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reduceMut = useMutation({
    mutationFn: ({
      kotId,
      lineId,
      qty,
      r,
    }: {
      kotId: string;
      lineId: string;
      qty: number;
      r: string;
    }) => voidKOTLine(kotId, lineId, { qty, reason: r }),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Reduction recorded as cancellation");
      setReduceTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = order?.items.filter((i) => !i.kot_id) ?? [];

  const draftFireMut = useMutation({
    mutationFn: () => fireKOT(orderId),
    onSuccess: (kot) => {
      invalidateBill(orderId, queryClient);
      toast.success(`KOT #${kot.kot_number} fired to kitchen`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const draftQtyMut = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      updateDraftItemQty(orderId, lineId, qty),
    onSuccess: () => invalidateBill(orderId, queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
  const draftRemoveMut = useMutation({
    mutationFn: (lineId: string) => removeDraftItem(orderId, lineId),
    onSuccess: () => invalidateBill(orderId, queryClient),
    onError: (e: Error) => toast.error(e.message),
  });

  if (kots.length === 0 && draft.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        No kitchen tickets yet — added items fire straight to the kitchen.
      </p>
    );
  }
  const lineEditable = (kot: KitchenTicketWithDerived, l: { status: string }) =>
    !!editable &&
    kot.status !== "SERVED" &&
    kot.status !== "CANCELLED" &&
    (l.status === "PENDING" || l.status === "ACCEPTED" || l.status === "PREPARING");

  // Pricing joins the order snapshot via order_line_id; missing joins fall
  // back to today's unpriced rendering rather than crashing.
  const priced = (kotLine: {
    order_line_id: string;
    qty: number;
    voided_qty: number;
    returned_qty?: number;
  }) => {
    const ol = order?.items.find((i) => i.id === kotLine.order_line_id);
    if (!ol || ol.qty <= 0) return null;
    const liveQty = kotLine.qty - kotLine.voided_qty - (kotLine.returned_qty ?? 0);
    if (liveQty <= 0)
      return {
        liveQty,
        unit: ol.unit_price_paise,
        pct: ol.tax_percent_snapshot,
        total: 0,
        extra: "",
      };
    const unit = ol.unit_price_paise;
    const pct = ol.tax_percent_snapshot;
    const total =
      Math.round((ol.line_total_paise * liveQty) / ol.qty) +
      Math.round((ol.line_tax_paise * liveQty) / ol.qty);
    const mods = ol.modifiers.map((m) => m.name_snapshot).join(", ");
    const extra = [mods ? `+${mods}` : "", ol.instructions ? `“${ol.instructions}”` : ""]
      .filter(Boolean)
      .join(" · ");
    return { liveQty, unit, pct, total, extra };
  };
  const kotTotal = (kot: KitchenTicketWithDerived) =>
    kot.lines.reduce((s, l) => s + (priced(l)?.total ?? 0), 0);

  return (
    <div className="space-y-2.5">
      {draft.length > 0 && (
        <div className="rounded-xl border border-dashed border-primary/40 p-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Draft KOT · {draft.reduce((s, l) => s + l.qty, 0)}×
            </p>
            <Button
              size="sm"
              className="h-8"
              disabled={draftFireMut.isPending}
              onClick={() => draftFireMut.mutate()}
              title="Fire all draft lines to kitchen"
            >
              {draftFireMut.isPending ? "Firing…" : "Fire to kitchen"}
            </Button>
          </div>
          <div className="space-y-1">
            {draft.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {l.qty}× {l.item_name_snapshot}
                  {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
                  {l.modifiers?.length
                    ? ` +${l.modifiers.map((m) => m.name_snapshot).join(", ")}`
                    : ""}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={draftQtyMut.isPending || draftRemoveMut.isPending}
                    onClick={() =>
                      l.qty <= 1
                        ? draftRemoveMut.mutate(l.id)
                        : draftQtyMut.mutate({ lineId: l.id, qty: l.qty - 1 })
                    }
                    aria-label={`Decrease ${l.item_name_snapshot}`}
                  >
                    <Icons.minus className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={draftQtyMut.isPending}
                    onClick={() => draftQtyMut.mutate({ lineId: l.id, qty: l.qty + 1 })}
                    aria-label={`Increase ${l.item_name_snapshot}`}
                  >
                    <Icons.add className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    disabled={draftRemoveMut.isPending}
                    onClick={() => draftRemoveMut.mutate(l.id)}
                    aria-label={`Remove ${l.item_name_snapshot}`}
                  >
                    <Icons.trash className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {kots.map((kot) => {
        const open = openId === kot.id;
        return (
          <div
            key={kot.id}
            className={cn(
              "rounded-xl border p-1",
              flashId === kot.id && "animate-pulse border-primary ring-2 ring-primary/40",
            )}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(open ? null : kot.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(open ? null : kot.id);
                }
              }}
              className="flex w-full cursor-pointer items-center justify-between px-2 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span className="shrink-0">KOT #{kot.kot_number}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                    kot.status === "READY" &&
                      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
                    (kot.status === "PREPARING" || kot.status === "ACCEPTED") &&
                      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                    kot.status === "SERVED" &&
                      "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                    kot.status === "NEW" &&
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                  )}
                >
                  {kot.status.toLowerCase()}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {kot.lines.length} item{KotLinesPlural(kot)} · {formatAge(kot.fired_at)} old
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-sm font-semibold">{formatINR(kotTotal(kot))}</span>
                <span onClick={(e) => e.stopPropagation()}>
                  <ReprintDialog
                    purpose="KOT"
                    refId={kot.id}
                    refLabel={`KOT #${kot.kot_number}`}
                    triggerLabel=""
                  />
                </span>
                <Icons.chevronRight
                  className={cn("size-4 transition-transform", open && "rotate-90")}
                />
              </span>
            </div>
            {open && (
              <div className="space-y-1 border-t px-2 py-2">
                {kot.lines.map((l) => {
                  const p = priced(l);
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                        l.status === "VOIDED" && "bg-destructive/10 text-destructive line-through",
                        l.status === "ACCEPTED" && "bg-sky-500/10",
                      )}
                    >
                      <span
                        className={cn("size-2 shrink-0 rounded-full", LINE_STATUS_DOT[l.status])}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {l.qty - l.voided_qty > 0 ? `${l.qty - l.voided_qty}× ` : ""}
                          {l.item_name_snapshot}
                          {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
                        </span>
                        {p && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatINR(p.unit)} × {p.liveQty} + GST {p.pct}%
                            {p.extra ? ` · ${p.extra}` : ""}
                          </span>
                        )}
                      </span>
                      {p && (
                        <span className="shrink-0 text-sm font-semibold">{formatINR(p.total)}</span>
                      )}
                      {lineEditable(kot, l) ? (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:h-9 max-lg:w-9"
                            title="Reduce (records cancellation)"
                            disabled={reduceMut.isPending}
                            onClick={() => {
                              setReason("");
                              setReduceQty(l.qty - l.voided_qty);
                              setReduceTarget({
                                kotId: kot.id,
                                lineId: l.id,
                                max: l.qty - l.voided_qty,
                                name: l.item_name_snapshot,
                              });
                            }}
                          >
                            <Icons.minus className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:h-9 max-lg:w-9"
                            title="Add one more as a new KOT"
                            disabled={plusMut.isPending}
                            onClick={() => plusMut.mutate(l.order_line_id)}
                          >
                            <Icons.add className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:h-9 max-lg:w-9"
                            title="Delete item (records cancellation)"
                            disabled={reduceMut.isPending}
                            onClick={() => {
                              setReason("");
                              setReduceQty(l.qty - l.voided_qty);
                              setReduceTarget({
                                kotId: kot.id,
                                lineId: l.id,
                                max: l.qty - l.voided_qty,
                                name: l.item_name_snapshot,
                              });
                            }}
                          >
                            <Icons.trash className="size-3.5" />
                          </Button>
                          {lineReturnable(kot, l) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="max-lg:h-9 max-lg:w-9"
                              title="Return item (post-sale — refunds to original payment)"
                              onClick={() =>
                                setReturnTarget({
                                  orderLineId: l.order_line_id,
                                  name: l.item_name_snapshot,
                                  maxQty: l.qty - l.voided_qty - (l.returned_qty ?? 0),
                                })
                              }
                            >
                              <Icons.refund className="size-3.5" />
                            </Button>
                          )}
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-0.5">
                          {lineReturnable(kot, l) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="max-lg:h-9 max-lg:w-9"
                              title="Return item (post-sale — refunds to original payment)"
                              onClick={() =>
                                setReturnTarget({
                                  orderLineId: l.order_line_id,
                                  name: l.item_name_snapshot,
                                  maxQty: l.qty - l.voided_qty - (l.returned_qty ?? 0),
                                })
                              }
                            >
                              <Icons.refund className="size-3.5" />
                            </Button>
                          )}
                          <span className="text-[10px] capitalize text-muted-foreground">
                            {l.status.toLowerCase()}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
                {kot.voids.length > 0 && (
                  <div className="pt-1">
                    {kot.voids.map((v) => (
                      <p key={v.id} className="text-xs text-destructive">
                        Voided {v.qty}× — {v.reason}
                      </p>
                    ))}
                  </div>
                )}
                {(kot.returns ?? []).length > 0 && (
                  <div className="pt-1">
                    {(kot.returns ?? []).map((r) => (
                      <p key={r.id} className="text-xs text-muted-foreground">
                        Returned {r.qty}× ({formatINR(r.amount_paise)}) — {r.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={reduceTarget != null} onOpenChange={(o) => !o && setReduceTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reduce {reduceTarget?.name}?</DialogTitle>
            <DialogDescription>
              The reduction is recorded as a cancellation on the KOT with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qty (max {reduceTarget?.max})</Label>
              <Input
                type="number"
                min={1}
                max={reduceTarget?.max ?? 1}
                value={reduceQty}
                onChange={(e) => setReduceQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input
                placeholder="Customer changed mind…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReduceTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                reduceMut.isPending ||
                !reason.trim() ||
                !reduceTarget ||
                reduceQty < 1 ||
                reduceQty > reduceTarget.max
              }
              onClick={() =>
                reduceTarget &&
                reduceMut.mutate({
                  kotId: reduceTarget.kotId,
                  lineId: reduceTarget.lineId,
                  qty: reduceQty,
                  r: reason.trim(),
                })
              }
            >
              Record cancellation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReturnDialog orderId={orderId} target={returnTarget} onClose={() => setReturnTarget(null)} />
    </div>
  );
}

/** Consolidated cancelled-items list across all KOTs of the order. */
export function CancelledItemsList({ kots }: { kots: KitchenTicketWithDerived[] }) {
  const entries = kots.flatMap((kot) =>
    kot.voids.map((v) => {
      const line = kot.lines.find((l) => l.id === v.kot_line_id);
      return {
        id: v.id,
        kotNumber: kot.kot_number,
        name: line?.item_name_snapshot ?? "Whole KOT",
        qty: v.qty,
        reason: v.reason,
      };
    }),
  );
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1 rounded-lg border border-destructive/30 p-2">
      <p className="text-xs font-medium uppercase text-destructive">
        Cancelled items ({entries.length})
      </p>
      {entries.map((e) => (
        <p key={e.id} className="text-xs text-destructive">
          KOT #{e.kotNumber} · {e.qty}× {e.name} — {e.reason}
        </p>
      ))}
    </div>
  );
}

function KotLinesPlural(kot: KitchenTicketWithDerived) {
  return kot.lines.length === 1 ? "" : "s";
}

export function invalidateBill(orderId: string, qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  qc.invalidateQueries({ queryKey: orderKeys.all });
  qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
  qc.invalidateQueries({ queryKey: paymentKeys.byOrder(orderId) });
  qc.invalidateQueries({ queryKey: paymentKeys.refundsByOrder(orderId) });
  qc.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
}

/**
 * Shared bill panel (terminal + order detail): KOTs, cancellations,
 * discount, splits, tender pad. Seating, add-items trigger and cancel are
 * opt-in per surface. Never says "cart" — this is the Bill.
 *
 * Sizing: `fit="natural"` (default) shrink-wraps content — the card extends
 * as KOTs are added and the page scrolls. `fit="fill"` keeps the docked
 * terminal behavior (fill bounded parent, internal scroll). No fixed heights.
 */
export default function OrderBillPanel({
  orderId,
  title,
  showSeating,
  showCustomer,
  onAddItems,
  showCancel,
  showSplit = true,
  showTender = true,
  showPayments = true,
  fit = "natural",
  onCompleted,
}: {
  orderId: string;
  title?: string;
  showSeating?: boolean;
  showCustomer?: boolean;
  onAddItems?: () => void;
  showCancel?: boolean;
  showSplit?: boolean;
  showTender?: boolean;
  showPayments?: boolean;
  fit?: "natural" | "fill";
  onCompleted?: (orderId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: kots } = useQuery(kotsByOrderQueryOptions(orderId));
  const { data: payments } = useQuery(paymentsByOrderQueryOptions(orderId));
  const { data: refunds } = useQuery(refundsByOrderQueryOptions(orderId));
  const { data: table } = useQuery({
    ...tableQueryOptions(order?.table_id ?? ""),
    enabled: !!order?.table_id,
  });

  const [discountOpen, setDiscountOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "itemwise" | "custom">("none");
  const [activePartition, setActivePartition] = useState<string | null>(null);
  const [opsOpen, setOpsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const tenderAnchorId = `bill-tender-${orderId}`;
  const [tab, setTab] = useState<string | null>(null);
  const focusTender = () => {
    setTab("payment");
    window.setTimeout(() => {
      const el = document.getElementById(tenderAnchorId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = el?.querySelector<HTMLInputElement>("input");
      if (input) input.focus({ preventScroll: true });
    }, 100);
  };
  const fireMut = useMutation({
    mutationFn: () => fireKOT(orderId),
    onSuccess: async (kot) => {
      invalidateBill(orderId, queryClient);
      toast.success(`KOT #${kot.kot_number} fired to kitchen`);
      const { latestJobForRef } = await import("@/features/print-studio/api/service");
      const job = await latestJobForRef("KOT", kot.id).catch(() => null);
      if (job && job.status !== "SENT") {
        toast.warning(
          `KOT print ${job.status.toLowerCase()}: ${job.last_error ?? "see Print History"}. Retry there.`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Preparing the bill…
        </CardContent>
      </Card>
    );
  }

  const paidList = (payments ?? []).filter((p) => p.status === "PAID");
  const refundedTotal = (refunds ?? [])
    .filter((r) => r.status === "REFUNDED")
    .reduce((s, r) => s + r.amount_paise, 0);
  const paidTotal = paidList.reduce((s, p) => s + p.amount_paise, 0) - refundedTotal;
  const balance = Math.max(0, order.grand_total_paise - paidTotal);
  const stamp = PAYMENT_STAMP[order.payment_status];
  const partitions = order.split?.partitions ?? [];
  const partitionDue = (label: string) => {
    const p = partitions.find((x) => x.label === label);
    if (!p) return balance;
    const got = paidList
      .filter((x) => x.partition_label === label)
      .reduce((s, x) => s + x.amount_paise, 0);
    return Math.max(0, p.amount_paise - got);
  };
  const dueAmount = activePartition ? partitionDue(activePartition) : balance;
  const isTerminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  const fill = fit === "fill";
  const drafts = order.items.filter((i) => !i.kot_id);

  return (
    <Card className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="min-w-0 truncate">{title ?? "Bill"}</span>
          <span className="flex items-center gap-1">
            {onAddItems && !isTerminal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={onAddItems}
                title="Add items — fires straight to kitchen"
                aria-label="Add items"
              >
                <Icons.add className="size-4" />
                <Icons.pizza className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPreviewOpen(true)}
              title="Print preview"
              aria-label="Print preview"
            >
              <Icons.receipt className="size-4" />
            </Button>
            {(kots?.length ?? 0) > 0 && (
              <ReprintDialog
                purpose="BILL"
                refId={orderId}
                refLabel={`Bill ${order.order_number}`}
                triggerLabel=""
              />
            )}
            <Badge variant="outline" className={cn("gap-1", stamp.className)}>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  order.payment_status === "PAID" && "bg-green-500",
                  order.payment_status === "PARTIAL" && "bg-amber-500",
                  order.payment_status === "UNPAID" && "bg-slate-400",
                )}
              />
              {stamp.label}
            </Badge>
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {order.order_number} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
        </p>
      </CardHeader>
      <CardContent className={fill ? "min-h-0 flex-1 space-y-4 overflow-y-auto pb-6" : "space-y-4"}>
        {drafts.length > 0 && !isTerminal && (
          <div className="px-1 py-1">
            <Button
              variant="secondary"
              className="h-11 w-full shrink-0 text-sm"
              disabled={fireMut.isPending}
              onClick={() => fireMut.mutate()}
              title="Fire pending items to kitchen without opening the picker"
            >
              {fireMut.isPending
                ? "Firing…"
                : `Fire ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
        <Tabs
          value={tab ?? (balance > 0 ? "payment" : "kots")}
          onValueChange={setTab}
          className="w-full"
        >
          <div className="sticky top-0 z-[5] -mx-1 bg-background/95 px-1 py-1.5 backdrop-blur-sm">
            <TabsList className="w-full justify-start gap-1 overflow-x-auto overflow-y-hidden flex-nowrap">
              <TabsTrigger value="kots" className="min-h-11 shrink-0 px-4 touch-manipulation">
                KOTs{(kots ?? []).length > 0 ? ` (${(kots ?? []).length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="bill" className="min-h-11 shrink-0 px-4 touch-manipulation">
                Bill
              </TabsTrigger>
              <TabsTrigger value="payment" className="min-h-11 shrink-0 px-4 touch-manipulation">
                Payment{balance > 0 ? ` · ${formatINR(balance)}` : ""}
              </TabsTrigger>
              {!!showCustomer && (
                <TabsTrigger value="customer" className="min-h-11 shrink-0 px-4 touch-manipulation">
                  Customer
                </TabsTrigger>
              )}
              <TabsTrigger value="more" className="min-h-11 shrink-0 px-4 touch-manipulation">
                More
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="kots" className="space-y-4 pt-2">
            <section aria-label="Kitchen tickets" className="space-y-2 rounded-xl border p-3">
              <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
                <span>Kitchen tickets</span>
                {(kots ?? []).length > 0 && <span>{(kots ?? []).length}</span>}
              </p>
              <KOTAccordion kots={kots ?? []} orderId={orderId} editable />
              <div data-kot-list-bottom />
            </section>

            <CancelledItemsList kots={kots ?? []} />
          </TabsContent>
          <TabsContent value="bill" className="space-y-4 pt-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatINR(order.subtotal_paise)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Discount
                  {order.discount_reason ? ` · ${order.discount_reason}` : ""}
                </span>
                <span className="flex items-center gap-1">
                  <span>
                    −{formatINR(Math.max(0, order.total_paise - order.grand_total_paise))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Edit discount"
                    onClick={() => setDiscountOpen(true)}
                  >
                    <Icons.edit className="size-3.5" />
                  </Button>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span>{formatINR(order.tax_paise)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatINR(order.grand_total_paise)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid {formatINR(paidTotal)}</span>
                <span>Balance {formatINR(balance)}</span>
              </div>
            </div>

            {showSplit && (!isTerminal || order.split) && (
              <SplitSection
                orderId={orderId}
                mode={splitMode}
                onModeChange={(m) => {
                  setSplitMode(m);
                  setActivePartition(null);
                }}
                activePartition={activePartition}
                onSelectPartition={setActivePartition}
              />
            )}
          </TabsContent>
          <TabsContent value="payment" className="space-y-4 pt-2">
            <section aria-label="Payment" className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Payment</p>
              {showTender && dueAmount > 0 && (
                <div id={tenderAnchorId} className="scroll-mt-20">
                  <TenderPad
                    orderId={orderId}
                    duePaise={dueAmount}
                    partitionLabel={activePartition}
                  />
                </div>
              )}

              {showPayments && paidList.length > 0 && (
                <div className="space-y-1">
                  {paidList.map((p: Payment) => (
                    <div
                      key={p.id}
                      className="flex justify-between rounded-md border px-2 py-1 text-xs"
                    >
                      <span className="capitalize">
                        {p.method.replace("_", " ")}
                        {p.partition_label ? ` · ${p.partition_label}` : ""}
                        {p.change_paise ? ` · change ${formatINR(p.change_paise)}` : ""}
                      </span>
                      <span className="font-medium">{formatINR(p.amount_paise)}</span>
                    </div>
                  ))}
                </div>
              )}

              {showPayments && (refunds ?? []).length > 0 && (
                <div className="space-y-1">
                  {(refunds ?? []).map((r) => {
                    const method =
                      paidList.find((p) => p.id === r.payment_id)?.method.replace("_", " ") ??
                      "payment";
                    return (
                      <div
                        key={r.id}
                        className="flex justify-between rounded-md border border-dashed px-2 py-1 text-xs"
                      >
                        <span className="flex items-center gap-1 capitalize text-muted-foreground">
                          <Icons.refund className="size-3" />
                          Refund → {method}
                          {r.status === "REFUND_PENDING" ? " · gateway pending" : ""}
                          {r.status === "REFUND_FAILED" ? " · failed" : ""}
                          {r.qty ? ` · ${r.qty}×` : ""}
                        </span>
                        <span className="font-medium">−{formatINR(r.amount_paise)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isTerminal && (
                <Button
                  className="h-11 w-full text-sm"
                  variant={balance > 0 ? "default" : "secondary"}
                  onClick={() => setCheckoutOpen(true)}
                  title={
                    balance > 0
                      ? "Review the bill and collect the balance"
                      : "Review the bill and complete the order"
                  }
                >
                  {balance > 0 ? (
                    <>
                      <Icons.billing className="mr-2 size-4" /> Settle · {formatINR(balance)}
                    </>
                  ) : (
                    <>
                      <Icons.checks className="mr-2 size-4" /> Complete order
                    </>
                  )}
                </Button>
              )}
            </section>
          </TabsContent>
          {!!showCustomer && (
            <TabsContent value="customer" className="space-y-4 pt-2">
              <BillCustomerTab orderId={orderId} />
            </TabsContent>
          )}
          <TabsContent value="more" className="space-y-4 pt-2">
            {showSeating && table && (
              <>
                <TableStrip
                  table={table}
                  activeGroupId={order.occupancy_group_id}
                  onOpenOps={() => setOpsOpen(true)}
                />
                <TableOpsDialog
                  tableId={table.id}
                  floorId={table.floor_id}
                  open={opsOpen}
                  onOpenChange={setOpsOpen}
                />
              </>
            )}
            {showCancel && <CancelOrderBlock orderId={orderId} />}
          </TabsContent>
        </Tabs>
      </CardContent>

      <DiscountDialog orderId={orderId} open={discountOpen} onOpenChange={setDiscountOpen} />
      <PreviewDialog orderId={orderId} open={previewOpen} onOpenChange={setPreviewOpen} />
      <CheckoutDialog
        orderId={orderId}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onCollect={focusTender}
        onCompleted={onCompleted}
      />
    </Card>
  );
}

function PreviewDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { preview, outlet, template } = useBillPreviewDoc(orderId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Print preview</DialogTitle>
          <DialogDescription>
            Live receipt — same layout math as the printed bytes.
          </DialogDescription>
        </DialogHeader>
        {preview && outlet && template ? (
          <>
            <p className="text-[11px] text-muted-foreground">{preview.qrCaption}</p>
            <ReceiptPreview
              doc={preview.doc}
              title="Bill preview"
              logoUrl={
                template.show_logo && typeof outlet.logo_url === "string" && outlet.logo_url
                  ? outlet.logo_url
                  : undefined
              }
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Loading preview…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CancelOrderBlock({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMut = useMutation({
    mutationFn: (r: string) => cancelOrder(orderId, { reason: r }),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Order cancelled");
      setCancelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order || order.status === "COMPLETED" || order.status === "CANCELLED") return null;

  return (
    <>
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
            <Input
              placeholder="Customer walked out…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
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
    </>
  );
}

function DiscountDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState(order?.discount_reason ?? "");

  const mut = useMutation({
    mutationFn: () =>
      setDiscount(orderId, {
        percent: kind === "percent" ? Number(value) : undefined,
        amount_paise: kind === "flat" ? toPaise(Number(value)) : undefined,
        reason,
      }),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Discount applied");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bill discount</DialogTitle>
          <DialogDescription>
            Pre-tax. Editable until the order completes — paid and balance re-derive.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["percent", "flat"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant={kind === k ? "default" : "outline"}
              size="sm"
              onClick={() => setKind(k)}
            >
              {k === "percent" ? "Percent %" : "Flat ₹"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {kind === "percent" ? "Percent (0–100)" : "Amount ₹"}
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "percent" ? "10" : "50"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Festival offer…"
            />
          </div>
        </div>
        <AmountPad value={value} onChange={setValue} allowDecimal={kind !== "percent"} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={mut.isPending || !value || !reason.trim()} onClick={() => mut.mutate()}>
            Apply discount
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SplitSection({
  orderId,
  mode,
  onModeChange,
  activePartition,
  onSelectPartition,
}: {
  orderId: string;
  mode: "none" | "equal" | "itemwise" | "custom";
  onModeChange: (m: "none" | "equal" | "itemwise" | "custom") => void;
  activePartition: string | null;
  onSelectPartition: (label: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: payments } = useQuery(paymentsByOrderQueryOptions(orderId));
  const [count, setCount] = useState(2);
  const [expanded, setExpanded] = useState(false);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [customRows, setCustomRows] = useState<{ label: string; amount: string }[]>([
    { label: "Guest 1", amount: "" },
    { label: "Guest 2", amount: "" },
  ]);
  const [editing, setEditing] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [padCustom, setPadCustom] = useState<number | null>(null);

  const buildMut = useMutation({
    mutationFn: (p: Parameters<typeof computeSplits>[1]) => computeSplits(orderId, p as any),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success(editing ? "Split updated" : "Bill split built");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (r: string) => clearSplit(orderId, { reason: r }),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Split removed");
      setEditing(false);
      setExpanded(false);
      onModeChange("none");
      onSelectPartition(null);
      setRemoveOpen(false);
      setRemoveReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return null;
  const isTerminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  const sharesTotal = (order.split?.partitions ?? []).reduce((s, p) => s + p.amount_paise, 0);
  const staleSplit = !!order.split && sharesTotal !== order.grand_total_paise;

  /** Reopen the builder prefilled from the live split (edit = guarded rebuild). */
  const startEdit = () => {
    const s = order.split;
    if (!s) return;
    if (s.mode === "equal") {
      setCount(s.partitions.length);
    } else if (s.mode === "custom") {
      setCustomRows(
        s.partitions.map((p) => ({ label: p.label, amount: (p.amount_paise / 100).toFixed(2) })),
      );
    } else {
      setCount(s.partitions.length);
      const a: Record<string, string> = {};
      for (const p of s.partitions) for (const lid of p.line_ids ?? []) a[lid] = p.label;
      setAssign(a);
    }
    onModeChange(s.mode);
    setExpanded(true);
    setEditing(true);
  };

  const showBuilders = !order.split || editing;
  const paidByLabel = (label: string) =>
    (payments ?? [])
      .filter((p) => p.status === "PAID" && p.partition_label === label)
      .reduce((s, p) => s + p.amount_paise, 0);

  if (!order.split && !expanded) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setExpanded(true)}>
        <Icons.add className="mr-2 size-4" /> Split bill
      </Button>
    );
  }

  // Settled split: display + tap-to-collect, with edit/remove (guarded by the
  // service when share payments exist, hidden on terminal orders).
  if (order.split && !editing) {
    return (
      <div className="space-y-2 rounded-lg border p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] capitalize text-muted-foreground">
            {order.split.mode} split — tap a share to collect against it
          </p>
          {!isTerminal && (
            <span className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={startEdit} title="Edit shares">
                <Icons.edit className="mr-1 size-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRemoveReason("");
                  setRemoveOpen(true);
                }}
                title="Remove split"
              >
                <Icons.trash className="mr-1 size-3.5" /> Remove
              </Button>
            </span>
          )}
        </div>
        {staleSplit && (
          <p className="text-[11px] text-amber-600">
            Bill changed since the split ({formatINR(sharesTotal)} vs{" "}
            {formatINR(order.grand_total_paise)}) — edit to rebuild.
          </p>
        )}
        <div className="space-y-1">
          {order.split.partitions.map((p) => {
            const got = paidByLabel(p.label);
            const left = Math.max(0, p.amount_paise - got);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onSelectPartition(activePartition === p.label ? null : p.label)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-2 py-1 text-xs",
                  activePartition === p.label && "border-primary bg-primary/5",
                  left === 0 && "text-muted-foreground",
                )}
              >
                <span>
                  {p.label} {left === 0 ? "· settled" : `· due ${formatINR(left)}`}
                </span>
                <span>{formatINR(p.amount_paise)}</span>
              </button>
            );
          })}
        </div>

        <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove split?</DialogTitle>
              <DialogDescription>
                The {order.split.mode} split ({order.split.partitions.length} shares) is deleted and
                the full bill becomes due again. Blocked while share payments exist. This is
                audited.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input
                placeholder="Guests paying together…"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoveOpen(false)}>
                Keep split
              </Button>
              <Button
                variant="destructive"
                disabled={removeMut.isPending || !removeReason.trim()}
                onClick={() => removeMut.mutate(removeReason.trim())}
              >
                Remove split
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="flex flex-wrap gap-1.5">
        {(["none", "equal", "itemwise", "custom"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (m === "none") setExpanded(false);
              onModeChange(m);
            }}
          >
            {m === "none"
              ? "No split"
              : m === "itemwise"
                ? "Item-wise"
                : m[0].toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </div>

      {editing && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Editing the {order.split?.mode} split — shares re-validate against paid amounts.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel edit
          </Button>
        </div>
      )}

      {mode === "equal" && showBuilders && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={2}
            max={24}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-8 w-20"
          />
          <Button
            size="sm"
            disabled={buildMut.isPending}
            onClick={() => buildMut.mutate({ mode: "equal", count })}
          >
            {editing ? "Save changes" : "Split equally"}
          </Button>
        </div>
      )}

      {mode === "itemwise" && showBuilders && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Shares</Label>
            <Input
              type="number"
              min={2}
              max={24}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-8 w-20"
            />
          </div>
          {order.items.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">
                {l.qty}× {l.item_name_snapshot}
              </span>
              <Select
                value={assign[l.id] ?? "__none"}
                onValueChange={(v) => setAssign((a) => ({ ...a, [l.id]: v === "__none" ? "" : v }))}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {Array.from({ length: count }, (_, i) => `Guest ${i + 1}`).map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button
            size="sm"
            disabled={buildMut.isPending}
            onClick={() => {
              const groups = new Map<string, string[]>();
              for (const l of order.items) {
                const g = assign[l.id];
                if (!g) {
                  toast.error("Assign every line to a share");
                  return;
                }
                groups.set(g, [...(groups.get(g) ?? []), l.id]);
              }
              buildMut.mutate({
                mode: "itemwise",
                assignments: [...groups.entries()].map(([label, line_ids]) => ({
                  label,
                  line_ids,
                })),
              });
            }}
          >
            {editing ? "Save changes" : "Build item-wise split"}
          </Button>
        </div>
      )}

      {mode === "custom" && showBuilders && (
        <div className="space-y-1.5">
          {customRows.map((r, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                value={r.label}
                onChange={(e) =>
                  setCustomRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className="h-8"
                placeholder={`Guest ${i + 1}`}
              />
              <Input
                type="text"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) =>
                  setCustomRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                  )
                }
                onFocus={() => setPadCustom(i)}
                className="h-8 w-28"
                placeholder="₹"
              />
            </div>
          ))}
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCustomRows((rows) => [
                  ...rows,
                  { label: `Guest ${rows.length + 1}`, amount: "" },
                ])
              }
            >
              <Icons.add className="mr-1 size-3.5" /> Share
            </Button>
            <Button
              size="sm"
              disabled={buildMut.isPending}
              onClick={() =>
                buildMut.mutate({
                  mode: "custom",
                  amounts: customRows.map((r) => ({
                    label: r.label.trim() || "Guest",
                    amount_paise: toPaise(Number(r.amount)),
                  })),
                })
              }
            >
              {editing ? "Save changes" : "Build custom split"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Shares must add up to {formatINR(order.grand_total_paise)}.
          </p>
          <AmountPad
            value={padCustom != null && customRows[padCustom] ? customRows[padCustom].amount : ""}
            onChange={(v) => {
              if (padCustom == null || !customRows[padCustom]) return;
              const i = padCustom;
              setCustomRows((rows) => rows.map((x, j) => (j === i ? { ...x, amount: v } : x)));
            }}
          />
        </div>
      )}

      {order.split && (
        <div className="space-y-1">
          <p className="text-[11px] capitalize text-muted-foreground">
            {order.split.mode} split — tap a share to collect against it
          </p>
          {order.split.partitions.map((p) => {
            const got = paidByLabel(p.label);
            const left = Math.max(0, p.amount_paise - got);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onSelectPartition(activePartition === p.label ? null : p.label)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-2 py-1 text-xs",
                  activePartition === p.label && "border-primary bg-primary/5",
                  left === 0 && "text-muted-foreground",
                )}
              >
                <span>
                  {p.label} {left === 0 ? "· settled" : `· due ${formatINR(left)}`}
                </span>
                <span>{formatINR(p.amount_paise)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type TenderRow = { method: PaymentMethod; amount: string; tendered: string };

/**
 * Tender pad with single + combined modes. Combined collects 2+ methods in
 * one go (e.g. part cash + part UPI) — each lands as its own payment record
 * so the ledger stays exact.
 */
export function TenderPad({
  orderId,
  duePaise,
  partitionLabel,
}: {
  orderId: string;
  duePaise: number;
  partitionLabel: string | null;
}) {
  const queryClient = useQueryClient();
  const [combined, setCombined] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [tendered, setTendered] = useState("");
  const [rows, setRows] = useState<TenderRow[]>([
    { method: "cash", amount: "", tendered: "" },
    { method: "upi", amount: "", tendered: "" },
  ]);
  // Which field the shared pad drives (single mode + combined rows).
  const [padTarget, setPadTarget] = useState<"amount" | "tendered">("amount");
  const [padRow, setPadRow] = useState<{ i: number; field: "amount" | "tendered" } | null>(null);
  const dueStr = (duePaise / 100).toFixed(2);

  const collectMut = useMutation({
    mutationFn: () =>
      collectPayment({
        order_id: orderId,
        method,
        amount_paise: toPaise(Number(amount)),
        tendered_paise: method === "cash" && tendered ? toPaise(Number(tendered)) : undefined,
        partition_label: partitionLabel ?? undefined,
      }),
    onSuccess: (p) => {
      invalidateBill(orderId, queryClient);
      toast.success(
        `Collected ${formatINR(p.amount_paise)}${p.change_paise ? ` · change ${formatINR(p.change_paise)}` : ""}`,
      );
      setAmount("");
      setTendered("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collectCombinedMut = useMutation({
    mutationFn: async (
      valid: { method: PaymentMethod; amount_paise: number; tendered_paise?: number }[],
    ) => {
      const done = [];
      for (const r of valid) {
        done.push(
          await collectPayment({
            order_id: orderId,
            method: r.method,
            amount_paise: r.amount_paise,
            tendered_paise: r.tendered_paise,
            partition_label: partitionLabel ?? undefined,
          }),
        );
      }
      return done;
    },
    onSuccess: (done) => {
      invalidateBill(orderId, queryClient);
      const total = done.reduce((s, p) => s + p.amount_paise, 0);
      toast.success(`Collected ${formatINR(total)} across ${done.length} methods`);
      setRows([
        { method: "cash", amount: "", tendered: "" },
        { method: "upi", amount: "", tendered: "" },
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const change =
    method === "cash" && tendered && amount
      ? Math.max(0, toPaise(Number(tendered)) - toPaise(Number(amount)))
      : 0;

  const parsedRows = rows.map((r) => ({
    method: r.method,
    amount_paise: r.amount ? toPaise(Number(r.amount)) : 0,
    tendered_paise: r.method === "cash" && r.tendered ? toPaise(Number(r.tendered)) : undefined,
  }));
  const rowsTotal = parsedRows.reduce((s, r) => s + r.amount_paise, 0);
  const rowsValid =
    parsedRows.length >= 2 &&
    parsedRows.every((r) => r.amount_paise > 0) &&
    rowsTotal > 0 &&
    rowsTotal <= duePaise &&
    parsedRows.every(
      (r) => r.method !== "cash" || !r.tendered_paise || r.tendered_paise >= r.amount_paise,
    );

  const updateRow = (i: number, patch: Partial<TenderRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Collect{partitionLabel ? ` — ${partitionLabel}` : ""} · due {formatINR(duePaise)}
        </p>
        <div className="flex gap-1">
          {([false, true] as const).map((c) => (
            <Button
              key={String(c)}
              type="button"
              variant={combined === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCombined(c)}
            >
              {c ? "Combined" : "Single"}
            </Button>
          ))}
        </div>
      </div>

      {!combined ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <Button
                key={m.value}
                type="button"
                variant={method === m.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMethod(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Amount ₹</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => setPadTarget("amount")}
                placeholder={(duePaise / 100).toFixed(2)}
              />
            </div>
            {method === "cash" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tendered ₹</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  onFocus={() => setPadTarget("tendered")}
                  placeholder="Cash received"
                />
              </div>
            )}
          </div>
          <AmountPad
            value={padTarget === "tendered" && method === "cash" ? tendered : amount}
            onChange={padTarget === "tendered" && method === "cash" ? setTendered : setAmount}
            showDenominations={method === "cash"}
            dueAmount={dueStr}
          />
          <div className="flex items-center gap-2">
            {change > 0 && (
              <span className="text-xs text-muted-foreground">Change {formatINR(change)}</span>
            )}
            <Button
              size="sm"
              className="ml-auto"
              disabled={collectMut.isPending || !amount || duePaise <= 0}
              onClick={() => collectMut.mutate()}
            >
              {collectMut.isPending ? "Collecting…" : "Collect"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Split one collection across methods — e.g. part cash, part UPI. Rows must add up to at
            most the due.
            {duePaise - rowsTotal > 0 && (
              <span className="ml-1 font-medium text-amber-600">
                {formatINR(duePaise - rowsTotal)} unpaid
              </span>
            )}
          </p>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Select
                value={r.method}
                onValueChange={(v) => updateRow(i, { method: v as PaymentMethod })}
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
                onFocus={() => setPadRow({ i, field: "amount" })}
                className="h-8"
                placeholder="₹ amount"
              />
              {r.method === "cash" && (
                <Input
                  type="text"
                  inputMode="decimal"
                  value={r.tendered}
                  onChange={(e) => updateRow(i, { tendered: e.target.value })}
                  onFocus={() => setPadRow({ i, field: "tendered" })}
                  className="h-8 w-24"
                  placeholder="Tendered"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                title="Fill with remaining due"
                onClick={() => {
                  const others = rowsTotal - (r.amount ? toPaise(Number(r.amount)) : 0);
                  updateRow(i, { amount: (Math.max(0, duePaise - others) / 100).toFixed(2) });
                }}
              >
                Fill
              </Button>
              {rows.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                >
                  <Icons.close className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((rs) => [...rs, { method: "upi", amount: "", tendered: "" }])}
            >
              <Icons.add className="mr-1 size-3.5" /> Method
            </Button>
            <span className="text-xs text-muted-foreground">
              Total {formatINR(rowsTotal)} of {formatINR(duePaise)}
            </span>
            <Button
              size="sm"
              className="ml-auto"
              disabled={collectCombinedMut.isPending || !rowsValid || duePaise <= 0}
              onClick={() => collectCombinedMut.mutate(parsedRows)}
            >
              {collectCombinedMut.isPending ? "Collecting…" : `Collect ${formatINR(rowsTotal)}`}
            </Button>
          </div>
          <AmountPad
            value={
              padRow && rows[padRow.i]
                ? padRow.field === "tendered" && rows[padRow.i].method === "cash"
                  ? rows[padRow.i].tendered
                  : rows[padRow.i].amount
                : ""
            }
            onChange={(v) => {
              if (!padRow || !rows[padRow.i]) return;
              updateRow(padRow.i, { [padRow.field]: v });
            }}
            showDenominations={!!padRow && rows[padRow.i]?.method === "cash"}
            dueAmount={dueStr}
          />
        </>
      )}
    </div>
  );
}

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
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { kotsByOrderQueryOptions, kitchenKeys } from "@/features/kitchen/api/queries";
import { tableQueryOptions } from "@/features/table/api/queries";
import CustomerLinkBlock from "@/features/customers/components/customer-link-block";
import SeatingSection from "@/features/table/components/seating-section";
import {
  paymentsByOrderQueryOptions,
  paymentKeys,
  refundsByOrderQueryOptions,
} from "@/features/payments/api/queries";
import { computeSplits, setDiscount } from "@/features/orders/api/service";
import { collectPayment } from "@/features/payments/api/service";
import { increaseKOTLineQty, voidKOTLine } from "@/features/kitchen/api/service";
import type { PaymentMethod, Payment } from "@/features/payments/api/types";
import type { KitchenTicketWithDerived } from "@/features/kitchen/api/types";
import { toast } from "sonner";

const LINE_STATUS_DOT: Record<string, string> = {
  PENDING: "bg-slate-400",
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
export function KOTAccordion({ kots, orderId, editable }: { kots: KitchenTicketWithDerived[]; orderId: string; editable?: boolean }) {
  const queryClient = useQueryClient();
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
  const [reduceTarget, setReduceTarget] = useState<{ kotId: string; lineId: string; max: number; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [reduceQty, setReduceQty] = useState(1);

  const plusMut = useMutation({
    mutationFn: ({ kotId, lineId }: { kotId: string; lineId: string }) =>
      increaseKOTLineQty(kotId, lineId, { extra: 1 }),
    onSuccess: () => invalidateBill(orderId, queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
  const reduceMut = useMutation({
    mutationFn: ({ kotId, lineId, qty, r }: { kotId: string; lineId: string; qty: number; r: string }) =>
      voidKOTLine(kotId, lineId, { qty, reason: r }),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Reduction recorded as cancellation");
      setReduceTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (kots.length === 0) {
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
    (l.status === "PENDING" || l.status === "PREPARING");

  return (
    <div className="space-y-2">
      {kots.map((kot) => {
        const open = openId === kot.id;
        return (
          <div
            key={kot.id}
            className={cn(
              "rounded-lg border",
              flashId === kot.id && "animate-pulse border-primary ring-2 ring-primary/40",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : kot.id)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-sm"
            >
              <span className="font-medium">
                KOT #{kot.kot_number}
                <span className="ml-1 text-xs font-normal capitalize text-muted-foreground">
                  {kot.status.toLowerCase()} · {kot.lines.length} item{ KotLinesPlural(kot)}
                </span>
              </span>
              <Icons.chevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
            </button>
            {open && (
              <div className="space-y-0.5 border-t px-2 py-1.5">
                {kot.lines.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1 py-0.5 text-sm",
                      l.status === "VOIDED" && "bg-destructive/10 text-destructive line-through",
                    )}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", LINE_STATUS_DOT[l.status])} />
                    <span className="min-w-0 flex-1 truncate">
                      {l.qty - l.voided_qty > 0 ? `${l.qty - l.voided_qty}× ` : ""}
                      {l.item_name_snapshot}
                      {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
                    </span>
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
                            setReduceTarget({ kotId: kot.id, lineId: l.id, max: l.qty - l.voided_qty, name: l.item_name_snapshot });
                          }}
                        >
                          <Icons.minus className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:h-9 max-lg:w-9"
                          title="Add one more"
                          disabled={plusMut.isPending}
                          onClick={() => plusMut.mutate({ kotId: kot.id, lineId: l.id })}
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
                            setReduceTarget({ kotId: kot.id, lineId: l.id, max: l.qty - l.voided_qty, name: l.item_name_snapshot });
                          }}
                        >
                          <Icons.trash className="size-3.5" />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[10px] capitalize text-muted-foreground">
                        {l.status.toLowerCase()}
                      </span>
                    )}
                  </div>
                ))}
                {kot.voids.length > 0 && (
                  <div className="pt-1">
                    {kot.voids.map((v) => (
                      <p key={v.id} className="text-xs text-destructive">
                        Voided {v.qty}× — {v.reason}
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
              <Input placeholder="Customer changed mind…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReduceTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reduceMut.isPending || !reason.trim() || !reduceTarget || reduceQty < 1 || reduceQty > reduceTarget.max}
              onClick={() =>
                reduceTarget &&
                reduceMut.mutate({ kotId: reduceTarget.kotId, lineId: reduceTarget.lineId, qty: reduceQty, r: reason.trim() })
              }
            >
              Record cancellation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

function invalidateBill(orderId: string, qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
  qc.invalidateQueries({ queryKey: orderKeys.all });
  qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
  qc.invalidateQueries({ queryKey: paymentKeys.byOrder(orderId) });
  qc.invalidateQueries({ queryKey: paymentKeys.refundsByOrder(orderId) });
}

/**
 * Terminal bill panel: KOTs, cancellations, discount, splits, tender pad.
 * Never says "cart" — this is the Bill.
 */
export default function OrderBillPanel({
  orderId,
  tableLabel,
  onAddItems,
}: {
  orderId: string;
  tableLabel: string;
  onAddItems: () => void;
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

  if (!order) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Preparing the bill…
        </CardContent>
      </Card>
    );
  }

  const paidList = (payments ?? []).filter((p) => p.status === "PAID");
  const refundedTotal = (refunds ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const paidTotal = paidList.reduce((s, p) => s + p.amount_paise, 0) - refundedTotal;
  const balance = Math.max(0, order.grand_total_paise - paidTotal);
  const stamp = PAYMENT_STAMP[order.payment_status];
  const partitions = order.split?.partitions ?? [];
  const partitionDue = (label: string) => {
    const p = partitions.find((x) => x.label === label);
    if (!p) return balance;
    const got = paidList.filter((x) => x.partition_label === label).reduce((s, x) => s + x.amount_paise, 0);
    return Math.max(0, p.amount_paise - got);
  };
  const dueAmount = activePartition ? partitionDue(activePartition) : balance;

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Bill — {tableLabel}</span>
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
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {order.order_number} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
          {table && (
            <span className="ml-2">
              · {table.seated_seats}/{table.capacity} seated
              {table.occupancy_fill !== "EMPTY" ? ` · ${table.occupancy_fill.toLowerCase()}` : ""}
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {table && <SeatingSection table={table} floorId={table.floor_id} />}

        <CustomerLinkBlock orderId={orderId} />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Kitchen tickets</p>
          <KOTAccordion kots={kots ?? []} orderId={orderId} editable />
          <div data-kot-list-bottom />
        </div>

        <CancelledItemsList kots={kots ?? []} />

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
              <span>−{formatINR(Math.max(0, order.total_paise - order.grand_total_paise))}</span>
              <Button variant="ghost" size="icon-sm" title="Edit discount" onClick={() => setDiscountOpen(true)}>
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

        <TenderPad orderId={orderId} duePaise={dueAmount} partitionLabel={activePartition} />

        {paidList.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Payments</p>
            {paidList.map((p: Payment) => (
              <div key={p.id} className="flex justify-between rounded-md border px-2 py-1 text-xs">
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

        <Button variant="outline" className="w-full" onClick={onAddItems}>
          <Icons.add className="mr-2 size-4" /> Add items
        </Button>
      </CardContent>

      <DiscountDialog orderId={orderId} open={discountOpen} onOpenChange={setDiscountOpen} />
    </Card>
  );
}

function DiscountDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
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
          <DialogDescription>Pre-tax. Only before firing — fired bills change via voids.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["percent", "flat"] as const).map((k) => (
            <Button key={k} type="button" variant={kind === k ? "default" : "outline"} size="sm" onClick={() => setKind(k)}>
              {k === "percent" ? "Percent %" : "Flat ₹"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{kind === "percent" ? "Percent (0–100)" : "Amount ₹"}</Label>
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "percent" ? "10" : "50"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Festival offer…" />
          </div>
        </div>
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

function SplitSection({
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
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [customRows, setCustomRows] = useState<{ label: string; amount: string }[]>([
    { label: "Guest 1", amount: "" },
    { label: "Guest 2", amount: "" },
  ]);

  const buildMut = useMutation({
    mutationFn: (p: Parameters<typeof computeSplits>[1]) => computeSplits(orderId, p as any),
    onSuccess: () => {
      invalidateBill(orderId, queryClient);
      toast.success("Bill split built");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return null;
  const paidByLabel = (label: string) =>
    (payments ?? [])
      .filter((p) => p.status === "PAID" && p.partition_label === label)
      .reduce((s, p) => s + p.amount_paise, 0);

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="flex flex-wrap gap-1.5">
        {(["none", "equal", "itemwise", "custom"] as const).map((m) => (
          <Button key={m} type="button" variant={mode === m ? "default" : "outline"} size="sm" onClick={() => onModeChange(m)}>
            {m === "none" ? "No split" : m === "itemwise" ? "Item-wise" : m[0].toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </div>

      {mode === "equal" && !order.split && (
        <div className="flex items-center gap-2">
          <Input type="number" min={2} max={24} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 w-20" />
          <Button size="sm" disabled={buildMut.isPending} onClick={() => buildMut.mutate({ mode: "equal", count })}>
            Split equally
          </Button>
        </div>
      )}

      {mode === "itemwise" && !order.split && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Shares</Label>
            <Input type="number" min={2} max={24} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 w-20" />
          </div>
          {order.items.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">
                {l.qty}× {l.item_name_snapshot}
              </span>
              <select
                className="rounded-md border bg-background px-1.5 py-1"
                value={assign[l.id] ?? ""}
                onChange={(e) => setAssign((a) => ({ ...a, [l.id]: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {Array.from({ length: count }, (_, i) => `Guest ${i + 1}`).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
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
                assignments: [...groups.entries()].map(([label, line_ids]) => ({ label, line_ids })),
              });
            }}
          >
            Build item-wise split
          </Button>
        </div>
      )}

      {mode === "custom" && !order.split && (
        <div className="space-y-1.5">
          {customRows.map((r, i) => (
            <div key={i} className="flex gap-1.5">
              <Input value={r.label} onChange={(e) => setCustomRows((rows) => rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-8" placeholder={`Guest ${i + 1}`} />
              <Input type="number" min={0} value={r.amount} onChange={(e) => setCustomRows((rows) => rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="h-8 w-28" placeholder="₹" />
            </div>
          ))}
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setCustomRows((rows) => [...rows, { label: `Guest ${rows.length + 1}`, amount: "" }])}>
              <Icons.add className="mr-1 size-3.5" /> Share
            </Button>
            <Button
              size="sm"
              disabled={buildMut.isPending}
              onClick={() =>
                buildMut.mutate({
                  mode: "custom",
                  amounts: customRows.map((r) => ({ label: r.label.trim() || "Guest", amount_paise: toPaise(Number(r.amount)) })),
                })
              }
            >
              Build custom split
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Shares must add up to {formatINR(order.grand_total_paise)}.</p>
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
function TenderPad({ orderId, duePaise, partitionLabel }: { orderId: string; duePaise: number; partitionLabel: string | null }) {
  const queryClient = useQueryClient();
  const [combined, setCombined] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [tendered, setTendered] = useState("");
  const [rows, setRows] = useState<TenderRow[]>([
    { method: "cash", amount: "", tendered: "" },
    { method: "upi", amount: "", tendered: "" },
  ]);

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
    mutationFn: async (valid: { method: PaymentMethod; amount_paise: number; tendered_paise?: number }[]) => {
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

  const change = method === "cash" && tendered && amount ? Math.max(0, toPaise(Number(tendered)) - toPaise(Number(amount))) : 0;

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
    parsedRows.every((r) => r.method !== "cash" || !r.tendered_paise || r.tendered_paise >= r.amount_paise);

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
            <Button key={String(c)} type="button" variant={combined === c ? "default" : "outline"} size="sm" onClick={() => setCombined(c)}>
              {c ? "Combined" : "Single"}
            </Button>
          ))}
        </div>
      </div>

      {!combined ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <Button key={m.value} type="button" variant={method === m.value ? "default" : "outline"} size="sm" onClick={() => setMethod(m.value)}>
                {m.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Amount ₹</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={(duePaise / 100).toFixed(2)} />
            </div>
            {method === "cash" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tendered ₹</Label>
                <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="Cash received" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAmount((duePaise / 100).toFixed(2))}>
              Exact
            </Button>
            {change > 0 && <span className="text-xs text-muted-foreground">Change {formatINR(change)}</span>}
            <Button size="sm" className="ml-auto" disabled={collectMut.isPending || !amount || duePaise <= 0} onClick={() => collectMut.mutate()}>
              {collectMut.isPending ? "Collecting…" : "Collect"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Split one collection across methods — e.g. part cash, part UPI. Rows must add up to at most the due.
            {duePaise - rowsTotal > 0 && (
              <span className="ml-1 font-medium text-amber-600">
                {formatINR(duePaise - rowsTotal)} unpaid
              </span>
            )}
          </p>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                className="rounded-md border bg-background px-1.5 py-1.5 text-xs"
                value={r.method}
                onChange={(e) => updateRow(i, { method: e.target.value as PaymentMethod })}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                value={r.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
                className="h-8"
                placeholder="₹ amount"
              />
              {r.method === "cash" && (
                <Input
                  type="number"
                  min={0}
                  value={r.tendered}
                  onChange={(e) => updateRow(i, { tendered: e.target.value })}
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
                <Button variant="ghost" size="icon-sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <Icons.close className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { method: "upi", amount: "", tendered: "" }])}>
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
        </>
      )}
    </div>
  );
}

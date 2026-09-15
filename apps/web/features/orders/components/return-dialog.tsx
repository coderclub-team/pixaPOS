"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
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
import { formatINR } from "@/lib/money";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { createReturn } from "@/features/orders/api/service";
import { previewReturnAllocation, type RefundAllocation } from "@/features/payments/api/service";
import { invalidateBill } from "./bill-panel";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

export type ReturnTarget = {
  orderLineId: string;
  name: string;
  maxQty: number;
};

/**
 * Item-wise post-sale return: qty stepper capped at returnable qty, mandatory
 * reason, live refund preview split by original payment method. Confirming
 * voids the qty off the KOT, shrinks the bill, wastes the food, and refunds
 * to the same methods the bill was paid with.
 */
export default function ReturnDialog({
  orderId,
  target,
  onClose,
}: {
  orderId: string;
  target: ReturnTarget | null;
  onClose: () => void;
}) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [allocations, setAllocations] = useState<RefundAllocation[]>([]);
  const [shortfall, setShortfall] = useState(0);

  const line = order?.items.find((i) => i.id === target?.orderLineId);
  const previewTotal = line
    ? Math.round((line.line_total_paise * qty) / line.qty) +
      Math.round((line.line_tax_paise * qty) / line.qty)
    : 0;

  useEffect(() => {
    setQty(1);
    setReason("");
    setAllocations([]);
    setShortfall(0);
  }, [target?.orderLineId]);

  useEffect(() => {
    if (!target || previewTotal < 1) {
      setAllocations([]);
      setShortfall(previewTotal);
      return;
    }
    let cancelled = false;
    previewReturnAllocation(orderId, previewTotal).then((r) => {
      if (cancelled) return;
      setAllocations(r.allocations);
      setShortfall(r.shortfall_paise);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, target, previewTotal]);

  const returnMut = useMutation({
    mutationFn: () =>
      createReturn(orderId, {
        lines: [{ order_line_id: target!.orderLineId, qty }],
        reason: reason.trim(),
      }),
    onSuccess: ({ ret }) => {
      invalidateBill(orderId, getQueryClient());
      toast.success(`Returned ${qty}× — ${formatINR(ret.total_paise)} refunded`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const max = Math.min(target?.maxQty ?? 1, line?.qty ?? 1);
  const valid = !!target && !!line && qty >= 1 && qty <= max && !!reason.trim() && shortfall <= 0;

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Return {target?.name}?</DialogTitle>
          <DialogDescription>
            The items come off the KOT, leave the bill, are wasted, and refund to the original
            payment methods.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Qty (max {max})</Label>
            <Input
              type="number"
              min={1}
              max={max}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input
              placeholder="Cold food, wrong item…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 px-2 py-1.5 text-sm">
          <div className="flex justify-between font-medium">
            <span>Refund</span>
            <span>{formatINR(previewTotal)}</span>
          </div>
          {allocations.map((a) => (
            <div key={a.payment_id} className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1 capitalize">
                <Icons.refund className="size-3" />
                {a.method.replace("_", " ")}
                {a.pending_gateway ? " · gateway pending" : ""}
              </span>
              <span>{formatINR(a.amount_paise)}</span>
            </div>
          ))}
          {shortfall > 0 && (
            <p className="pt-1 text-[11px] text-destructive">
              Short {formatINR(shortfall)} — payments cover less than this return.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || returnMut.isPending} onClick={() => returnMut.mutate()}>
            {returnMut.isPending ? "Returning…" : `Return ${qty}×`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

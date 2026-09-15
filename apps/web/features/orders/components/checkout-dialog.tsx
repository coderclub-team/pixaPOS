"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { formatINR } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { kitchenKeys } from "@/features/kitchen/api/queries";
import {
  paymentKeys,
  paymentsByOrderQueryOptions,
  refundsByOrderQueryOptions,
} from "@/features/payments/api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { completeOrder } from "@/features/orders/api/service";
import { toast } from "sonner";

/**
 * Checkout review: shows the full bill details and asks how to finish —
 * collect the remaining balance, or complete the order (SERVED + zero due).
 * Settlement (money) stays separate from completion (fulfillment + money).
 */
export default function CheckoutDialog({
  orderId,
  open,
  onOpenChange,
  onCollect,
  onCompleted,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollect: () => void;
  onCompleted?: (orderId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: order } = useQuery({ ...orderQueryOptions(orderId), enabled: open });
  const { data: payments } = useQuery({ ...paymentsByOrderQueryOptions(orderId), enabled: open });
  const { data: refunds } = useQuery({ ...refundsByOrderQueryOptions(orderId), enabled: open });
  const [completing, setCompleting] = useState(false);

  const completeMut = useMutation({
    mutationFn: () => completeOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.byOrder(orderId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
      toast.success(`Order ${order?.order_number ?? ""} completed — table free`.trim());
      setCompleting(false);
      onOpenChange(false);
      onCompleted?.(orderId);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setCompleting(false);
    },
  });

  const paidList = (payments ?? []).filter((p) => p.status === "PAID");
  const refunded = (refunds ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const paid = paidList.reduce((s, p) => s + p.amount_paise, 0) - refunded;
  const grand = order?.grand_total_paise ?? 0;
  const balance = Math.max(0, grand - paid);
  const served = order?.status === "SERVED";
  const canComplete = served && balance <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Checkout{order ? ` — ${order.order_number}` : ""}</DialogTitle>
          <DialogDescription>
            Review the bill, then collect any balance or complete the order.
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>
                {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.kot_count}{" "}
                KOT{order.kot_count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(order.subtotal_paise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>−{formatINR(Math.max(0, order.total_paise - order.grand_total_paise))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST</span>
              <span>{formatINR(order.tax_paise)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Total</span>
              <span>{formatINR(grand)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatINR(paid)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">Balance</span>
              <span>{formatINR(balance)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Kitchen</span>
              <span className="capitalize">
                {served ? "served ✓" : order.status.toLowerCase().replace("_", " ")}
              </span>
            </div>
            {!served && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                Completion needs the kitchen to serve everything first — payment can be collected
                anytime.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {balance > 0 && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onCollect();
              }}
            >
              Collect {formatINR(balance)}
            </Button>
          )}
          <Button
            variant={balance <= 0 ? "default" : "outline"}
            disabled={!canComplete || completeMut.isPending || completing}
            title={
              !served
                ? "Kitchen hasn't served everything yet"
                : balance > 0
                  ? "Collect the balance first"
                  : "Fulfillment done and bill settled — complete the order"
            }
            onClick={() => {
              setCompleting(true);
              completeMut.mutate();
            }}
          >
            {completeMut.isPending || completing ? "Completing…" : "Complete order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

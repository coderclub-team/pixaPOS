"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { formatINR } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { completeOrder } from "@/features/orders/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import {
  paymentsByOrderQueryOptions,
  refundsByOrderQueryOptions,
} from "@/features/payments/api/queries";
import type { Payment, Refund } from "@/features/payments/api/types";
import { TenderPad } from "./bill-panel";

/**
 * Standalone Payments card for the order detail route: tender pad against
 * the selected share (or full balance) plus the immutable payment ledger
 * and record-only refunds.
 */
export default function PaymentsCard({
  orderId,
  activePartition,
}: {
  orderId: string;
  activePartition: string | null;
}) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: payments } = useQuery(paymentsByOrderQueryOptions(orderId));
  const { data: refunds } = useQuery(refundsByOrderQueryOptions(orderId));

  const completeMut = useMutation({
    mutationFn: () => completeOrder(orderId),
    onSuccess: (o) => {
      getQueryClient().invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
      getQueryClient().invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
      toast.success(`Order ${o.order_number} completed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Loading payments…
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Payments</span>
          <span className="text-xs font-normal text-muted-foreground">
            Paid {formatINR(paidTotal)} · Balance {formatINR(balance)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dueAmount > 0 && (
          <TenderPad orderId={orderId} duePaise={dueAmount} partitionLabel={activePartition} />
        )}

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

        {(refunds ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Refunds</p>
            {(refunds ?? []).map((r: Refund) => (
              <div key={r.id} className="flex justify-between rounded-md border px-2 py-1 text-xs">
                <span className="truncate">
                  {r.reason} · {r.status.toLowerCase().replace("_", " ")}
                </span>
                <span className="shrink-0 font-medium">−{formatINR(r.amount_paise)}</span>
              </div>
            ))}
          </div>
        )}

        {paidList.length === 0 && (refunds ?? []).length === 0 && dueAmount <= 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Nothing due on this bill.
          </p>
        )}

        {order.status === "SERVED" && (
          <Button
            className="w-full"
            disabled={completeMut.isPending || balance > 0}
            title={
              balance > 0
                ? `Collect ${formatINR(balance)} before completing`
                : "Fulfillment done and bill settled — complete the order"
            }
            onClick={() => completeMut.mutate()}
          >
            {completeMut.isPending ? "Completing…" : "Mark completed"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

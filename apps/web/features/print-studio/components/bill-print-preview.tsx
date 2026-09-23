"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { paymentsByOrderQueryOptions } from "@/features/payments/api/queries";
import { paidTotalForOrder } from "@/features/payments/api/service";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { templateQueryOptions } from "../api/queries";
import { activeUpiId } from "@/features/outlet/api/types";
import { buildBillDoc } from "../api/docs";
import ReceiptPreview from "./receipt-preview";
import { cn } from "@pixa/ui/lib/utils";

/** Collapsible live receipt preview for the order bill panel. */
export default function BillPrintPreview({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: payments } = useQuery(paymentsByOrderQueryOptions(orderId));
  const { data: outlet } = useQuery(outletQueryOptions);
  const { data: template } = useQuery(templateQueryOptions("BILL"));
  const [paid, setPaid] = useState(0);

  useEffect(() => {
    let live = true;
    paidTotalForOrder(orderId)
      .then((p) => {
        if (live) setPaid(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [orderId, payments]);

  const preview = useMemo(() => {
    if (!order || !outlet || !template) return null;
    const balance = Math.max(0, order.grand_total_paise - paid);
    const defaultVpa = activeUpiId(outlet);
    const showQR = template.qr === "UPI" && !!defaultVpa && balance > 0;
    const qrCaption = showQR
      ? `QR shown · UPI collect ${(paid > 0 ? balance : order.grand_total_paise) / 100}`
      : !defaultVpa
        ? "QR omitted: no default UPI ID (Profile → Payments)"
        : balance <= 0
          ? "QR omitted: bill settled"
          : "QR omitted: template QR kind is not UPI";
    const doc = buildBillDoc({
      billing: { order, paid_paise: paid, balance_paise: balance },
      payments: (payments ?? []).filter((p) => p.status === "PAID"),
      outlet,
      template,
      upiId: showQR && defaultVpa ? defaultVpa : undefined,
      upiTr: order.order_number,
      qrAmountPaise: paid > 0 ? balance : order.grand_total_paise,
    });
    return { doc, qrCaption };
  }, [order, payments, outlet, template, paid]);
  return (
    <section aria-label="Print preview" className="space-y-2 rounded-xl border p-3">
      <Button
        variant="ghost"
        className="flex w-full items-center justify-between px-1 text-xs font-medium uppercase text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Print preview</span>
        <Icons.chevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
      </Button>
      {open &&
        (preview && outlet && template ? (
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
        ))}
    </section>
  );
}

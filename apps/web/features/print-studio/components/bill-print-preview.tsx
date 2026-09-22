"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { paymentsByOrderQueryOptions } from "@/features/payments/api/queries";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { templateQueryOptions } from "../api/queries";
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

  const doc = useMemo(() => {
    if (!order || !outlet || !template) return null;
    return buildBillDoc({
      billing: { order, paid_paise: 0, balance_paise: 0 },
      payments: (payments ?? []).filter((p) => p.status === "PAID"),
      outlet,
      template,
    });
  }, [order, payments, outlet, template]);

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
        (doc ? (
          <ReceiptPreview doc={doc} title="Bill preview" />
        ) : (
          <p className="text-xs text-muted-foreground">Loading preview…</p>
        ))}
    </section>
  );
}

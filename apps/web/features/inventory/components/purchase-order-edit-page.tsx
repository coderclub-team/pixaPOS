"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { purchaseOrderQueryOptions } from "../api/queries";
import PurchaseOrderForm from "./purchase-order-form";

export default function PurchaseOrderEditPage({ poId }: { poId: string }) {
  const { data: po } = useSuspenseQuery(purchaseOrderQueryOptions(poId));
  if (!po) notFound();
  if (po.status === "received") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center text-muted-foreground">
        Cannot edit received PO (GRN done). PO {po.po_number} is already in inventory.
      </div>
    );
  }
  if (po.status === "cancelled") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center text-muted-foreground">
        Cannot edit cancelled PO.
      </div>
    );
  }
  return <PurchaseOrderForm pageTitle="Update Purchase Order" initialData={po} />;
}

"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { purchaseQueryOptions } from "../api/queries";
import PurchaseForm from "./purchase-form";

export default function PurchaseEditPage({ purchaseId }: { purchaseId: string }) {
  const { data: p } = useSuspenseQuery(purchaseQueryOptions(purchaseId));
  if (!p) notFound();
  if (p.payment_status === "paid") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center text-muted-foreground">
        Cannot edit paid purchase {p.purchase_number} — create credit note.
      </div>
    );
  }
  return <PurchaseForm pageTitle="Update Purchase" initialData={p} />;
}

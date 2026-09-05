"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { purchaseQueryOptions, inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPurchase } from "../api/service";
import PurchaseForm from "./purchase-form";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";

export default function PurchaseEditPage({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const { data: p, isPending } = useQuery(purchaseQueryOptions(purchaseId));
  const cloneMut = useMutation({
    mutationFn: async (id: string) => {
      if (!p) throw new Error("Not found");
      return createPurchase({
        supplier_id: p.supplier_id,
        items: p.items as any,
        bill_date: new Date().toISOString().slice(0, 10),
        due_date: p.due_date,
        paid_amount: 0,
        payment_mode: "credit",
        notes: p.notes,
        reference: (p as any).reference,
      } as any);
    },
    onSuccess: (cloned: any) => {
      const qc = getQueryClient();
      qc.setQueryData(inventoryKeys.purchase(cloned.id), cloned);
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`Cloned to ${cloned.purchase_number}`);
      router.push(`/dashboard/inventory/purchases/${cloned.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const handleShare = async () => {
    if (!p) return;
    const itemsText = p.items
      .map(
        (it) =>
          `• ${it.material_name ?? it.material_id} ${it.qty} @₹${it.unit_cost} GST${it.tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase ${p.purchase_number} from PixaPOS\nSupplier: ${p.supplier_name} (${p.supplier_id})\nBill: ${new Date(p.bill_date).toLocaleDateString()} Due: ${p.due_date ? new Date(p.due_date).toLocaleDateString() : "-"} PO: ${p.po_number ?? "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${p.subtotal} GST: ₹${p.tax_amount} Total: ₹${p.total_amount} Paid: ₹${p.paid_amount}\nNotes: ${p.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Purchase ${p.purchase_number}`, text });
        toast.success("Purchase shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Purchase copied");
      } else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {}
  };
  if (isPending)
    return (
      <div className="mx-auto w-full max-w-3xl py-12 text-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!p)
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-8 text-center">
        <p className="font-medium">Purchase not found</p>
        <p className="mt-1 text-sm text-muted-foreground">{purchaseId} does not exist.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/dashboard/inventory/purchases">
            <Button variant="outline">Back to list</Button>
          </Link>
          <Link href="/dashboard/inventory/purchases/new">
            <Button>Create Purchase</Button>
          </Link>
        </div>
      </div>
    );
  if (p.payment_status === "paid") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">
          Cannot edit paid purchase {p.purchase_number} — create credit note.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Zoho/Odoo lock paid bills — clone for correction.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Icons.share className="mr-1 h-4 w-4" /> Share
          </Button>
          <Button onClick={() => cloneMut.mutate(p.id)} disabled={cloneMut.isPending}>
            <Icons.fileTypePdf className="mr-1 h-4 w-4" /> Clone
          </Button>
        </div>
      </div>
    );
  }
  return <PurchaseForm pageTitle="Update Purchase" initialData={p} />;
}

"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { purchaseOrderQueryOptions, inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clonePurchaseOrder } from "../api/service";
import PurchaseOrderForm from "./purchase-order-form";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";

export default function PurchaseOrderEditPage({ poId }: { poId: string }) {
  const router = useRouter();
  // Use non-suspense query to avoid hard 404 on stale dehydrated null; allow client refetch from persisted store
  const { data: po, isPending } = useQuery(purchaseOrderQueryOptions(poId));
  const cloneMut = useMutation({
    mutationFn: (id: string) => clonePurchaseOrder(id),
    onSuccess: (cloned) => {
      const qc = getQueryClient();
      qc.setQueryData(inventoryKeys.purchaseOrder(cloned.id), cloned);
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`Cloned to ${cloned.po_number}`);
      router.push(`/dashboard/inventory/purchase-orders/${cloned.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const handleShare = async () => {
    if (!po) return;
    const itemsText = po.items
      .map(
        (it) =>
          `• ${it.material_name ?? it.material_id} ${it.qty}${(it as any).unit ?? ""} @₹${it.unit_cost} GST${(it as any).tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase Order ${po.po_number} from PixaPOS\nSupplier: ${po.supplier_name} (${po.supplier_id})\nPO Date: ${new Date(po.po_date).toLocaleDateString()} Ref: ${po.reference ?? "-"}\nDelivery: ${po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "-"} Payment: ${(po as any).payment_date ? new Date((po as any).payment_date).toLocaleDateString() : "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${(po as any).subtotal} GST: ₹${(po as any).tax_amount} Total: ₹${po.total_amount}\nNotes: ${po.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `PO ${po.po_number}`, text });
        toast.success("PO shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("PO copied");
      } else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {}
  };
  if (isPending)
    return (
      <div className="mx-auto w-full max-w-3xl py-12 text-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!po)
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-8 text-center">
        <p className="font-medium">Purchase Order not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {poId} does not exist or was created in a previous session before persistence. It may have
          been a cloned draft (e.g. po_mtobsvnt).
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/dashboard/inventory/purchase-orders">
            <Button variant="outline">Back to list</Button>
          </Link>
          <Link href="/dashboard/inventory/purchase-orders/new">
            <Button>Create PO</Button>
          </Link>
        </div>
      </div>
    );
  if (po.status === "received") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">
          Cannot edit received PO (GRN done). PO {po.po_number} is already in inventory.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Zoho/Odoo lock received bills — create a new PO via Clone.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Icons.share className="mr-1 h-4 w-4" /> Share
          </Button>
          <Button onClick={() => cloneMut.mutate(po.id)} disabled={cloneMut.isPending}>
            <Icons.fileTypePdf className="mr-1 h-4 w-4" /> Clone PO
          </Button>
        </div>
      </div>
    );
  }
  if (po.status === "cancelled") {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">Cannot edit cancelled PO.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Icons.share className="mr-1 h-4 w-4" /> Share
          </Button>
          <Button onClick={() => cloneMut.mutate(po.id)} disabled={cloneMut.isPending}>
            <Icons.fileTypePdf className="mr-1 h-4 w-4" /> Clone PO
          </Button>
        </div>
      </div>
    );
  }
  return <PurchaseOrderForm pageTitle="Update Purchase Order" initialData={po} />;
}

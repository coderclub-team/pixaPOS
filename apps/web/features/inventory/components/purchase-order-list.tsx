"use client";
import type { PurchaseOrder } from "../api/types";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { clonePurchaseOrder, deletePurchaseOrder } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SortTh, useSorting } from "@/components/sort-th";
import type { CsvColumn } from "@/features/system/lib/csv";

function statusClass(s: string) {
  if (s === "received") return "text-green-600";
  if (s === "sent") return "text-amber-600";
  if (s === "draft") return "text-muted-foreground";
  return "text-destructive";
}

export const purchaseOrderExportColumns: CsvColumn<PurchaseOrder>[] = [
  { key: "po_number", label: "PO #", get: (po) => po.po_number },
  { key: "supplier_name", label: "Supplier", get: (po) => po.supplier_name ?? "" },
  { key: "po_date", label: "PO Date", get: (po) => po.po_date },
  { key: "expected_at", label: "Expected Delivery", get: (po) => po.expected_at ?? "" },
  { key: "reference", label: "Reference", get: (po) => po.reference ?? "" },
  { key: "items_count", label: "Items Count", get: (po) => po.items.length },
  {
    key: "items_list",
    label: "Items List",
    get: (po) => po.items.map((it) => `${it.material_name} ×${it.qty} ${it.unit ?? ""}`).join(", "),
  },
  { key: "subtotal", label: "Subtotal", get: (po) => `₹${po.subtotal.toFixed(2)}` },
  { key: "tax_amount", label: "Tax", get: (po) => `₹${po.tax_amount.toFixed(2)}` },
  { key: "total_amount", label: "Total", get: (po) => `₹${po.total_amount.toFixed(2)}` },
  { key: "status", label: "Status", get: (po) => po.status },
];

export function PurchaseOrderList({ orders }: { orders: PurchaseOrder[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<PurchaseOrder>("po_date", "desc");
  const rows = sorted(orders, {
    po_number: (po) => po.po_number,
    supplier_name: (po) => po.supplier_name ?? "",
    po_date: (po) => po.po_date,
    expected_at: (po) => po.expected_at ?? "",
    reference: (po) => po.reference ?? "",
    items_count: (po) => po.items.length,
    subtotal: (po) => po.subtotal,
    tax_amount: (po) => po.tax_amount,
    total_amount: (po) => po.total_amount,
    status: (po) => po.status,
  });

  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.cart className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No purchase orders</p>
            <p className="text-sm text-muted-foreground">
              Create PO to replenish raw materials — draft/sent stays out of stock until Purchase
              bill (GRN).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortTh
                  label="PO Number"
                  column="po_number"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Supplier"
                  column="supplier_name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Items"
                  column="items_count"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Total"
                  column="total_amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((po) => (
              <PurchaseOrderRow key={po.id} po={po} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PurchaseOrderRow({ po }: { po: PurchaseOrder }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const delMut = useMutation({
    mutationFn: (id: string) => deletePurchaseOrder(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase order deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const isEditable = po.status === "draft" || po.status === "sent";
  const isDeletable = po.status === "draft" || po.status === "sent";
  const isReceived = po.status === "received";
  const visibleCount = 3;
  const visibleItems = po.items.slice(0, visibleCount);
  const remaining = po.items.length - visibleItems.length;

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
    const itemsText = po.items
      .map(
        (it) =>
          `• ${it.material_name ?? it.material_id} ${it.qty}${it.unit ?? ""} @₹${it.unit_cost} GST${it.tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase Order ${po.po_number} from PixaPOS\nSupplier: ${po.supplier_name} (${po.supplier_id})\nPO Date: ${new Date(po.po_date).toLocaleDateString()} Ref: ${po.reference ?? "-"}\nDelivery: ${po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "-"} Payment: ${(po as any).payment_date ? new Date((po as any).payment_date).toLocaleDateString() : "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${(po as any).subtotal} GST: ₹${(po as any).tax_amount} Total: ₹${po.total_amount}\nNotes: ${po.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `PO ${po.po_number}`, text });
        toast.success("PO shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("PO copied — paste to share");
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch {
      // cancelled
    }
  };

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete purchase order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {po.po_number}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => delMut.mutate(po.id)}
              disabled={delMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/purchase-orders/${po.id}`} className="underline">
            {po.po_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">
            {new Date(po.po_date).toLocaleDateString()}
          </div>
          {po.status === "received" && po.received_at && (
            <div className="text-[10px] text-muted-foreground">
              GRN {new Date(po.received_at).toLocaleDateString()}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div>{po.supplier_name}</div>
          <div className="text-[10px] text-muted-foreground">
            Delivery {po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "-"}
          </div>
          {po.reference && (
            <div className="text-[10px] text-muted-foreground">Ref {po.reference}</div>
          )}
          {(po as any).payment_date && (
            <div className="text-[10px] text-muted-foreground">
              Pay {new Date((po as any).payment_date).toLocaleDateString()}
            </div>
          )}
        </TableCell>
        <TableCell
          className="text-xs"
          title={po.items.map((it) => `${it.material_name} x${it.qty} ${it.unit ?? ""}`).join(", ")}
        >
          {visibleItems.map((it) => `${it.material_name} ×${it.qty} ${it.unit ?? ""}`).join(", ")}
          {remaining > 0 && <span className="text-muted-foreground"> +{remaining} more</span>}
        </TableCell>
        <TableCell>
          <div>₹{po.total_amount}</div>
          <div className="text-[10px] text-muted-foreground">Sub ₹{(po as any).subtotal} + GST</div>
        </TableCell>
        <TableCell>
          <span className={`text-xs font-medium capitalize ${statusClass(po.status)}`}>
            {po.status}
          </span>
          {po.status !== "received" && (
            <div className="text-[10px] text-muted-foreground">Not in stock</div>
          )}
          {po.status === "received" && (
            <div className="text-[10px] text-green-600">In stock (GRN)</div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
              <span className="sr-only">Open menu</span>
              <Icons.ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                {isEditable && (
                  <DropdownMenuItem
                    onClick={() => router.push(`/dashboard/inventory/purchase-orders/${po.id}`)}
                  >
                    <Icons.edit className="mr-2 h-4 w-4" /> Update
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleShare}>
                  <Icons.share className="mr-2 h-4 w-4" /> Share
                </DropdownMenuItem>
                {isDeletable && (
                  <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                    <Icons.trash className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
                {isReceived && (
                  <DropdownMenuItem
                    onClick={() => cloneMut.mutate(po.id)}
                    disabled={cloneMut.isPending}
                  >
                    <Icons.fileTypePdf className="mr-2 h-4 w-4" /> Clone
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </>
  );
}

"use client";
import type { PurchaseReturn } from "../api/types";
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
import { approvePurchaseReturn, cancelPurchaseReturn } from "../api/service";
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
  if (s === "approved") return "text-green-600";
  if (s === "draft") return "text-amber-600";
  return "text-destructive";
}

export const purchaseReturnExportColumns: CsvColumn<PurchaseReturn>[] = [
  { key: "return_number", label: "Return #", get: (r) => r.return_number },
  { key: "purchase_number", label: "Original Purchase", get: (r) => r.purchase_number ?? "" },
  { key: "supplier_name", label: "Supplier", get: (r) => r.supplier_name ?? "" },
  { key: "bill_date", label: "Bill Date", get: (r) => r.bill_date },
  {
    key: "reason",
    label: "Reason",
    get: (r) => r.reason.replaceAll("_", " "),
  },
  { key: "restock", label: "Restock", get: (r) => (r.restock ? "yes" : "no") },
  { key: "items_count", label: "Items Count", get: (r) => r.items.length },
  {
    key: "items_list",
    label: "Items List",
    get: (r) =>
      r.items.map((it) => `${it.material_name} ${it.qty_returned}/${it.qty_original}`).join(", "),
  },
  {
    key: "subtotal_refund",
    label: "Subtotal Refund",
    get: (r) => `₹${r.subtotal_refund.toFixed(2)}`,
  },
  { key: "tax_refund", label: "Tax Refund", get: (r) => `₹${r.tax_refund.toFixed(2)}` },
  { key: "total_refund", label: "Total Refund", get: (r) => `₹${r.total_refund.toFixed(2)}` },
  { key: "status", label: "Status", get: (r) => r.status },
];

export function PurchaseReturnList({ returns }: { returns: PurchaseReturn[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<PurchaseReturn>("bill_date", "desc");
  const rows = sorted(returns, {
    return_number: (r) => r.return_number,
    purchase_number: (r) => r.purchase_number ?? "",
    supplier_name: (r) => r.supplier_name ?? "",
    bill_date: (r) => r.bill_date,
    reason: (r) => r.reason,
    restock: (r) => r.restock,
    items_count: (r) => r.items.length,
    subtotal_refund: (r) => r.subtotal_refund,
    tax_refund: (r) => r.tax_refund,
    total_refund: (r) => r.total_refund,
    status: (r) => r.status,
  });

  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.fileTypePdf className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No returns</p>
            <p className="text-sm text-muted-foreground">
              Create return from a purchase — partial or full. Approved returns deduct stock and act
              as vendor credit.
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
                  label="Return #"
                  column="return_number"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Original Purchase"
                  column="purchase_number"
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
                  label="Refund"
                  column="total_refund"
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
            {rows.map((r) => (
              <ReturnRow key={r.id} ret={r} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReturnRow({ ret }: { ret: PurchaseReturn }) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const approveMut = useMutation({
    mutationFn: () => approvePurchaseReturn(ret.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`Return ${ret.return_number} approved — stock deducted`);
      setApproveOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelPurchaseReturn(ret.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Return cancelled");
      setCancelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const isDraft = ret.status === "draft";
  const visibleItems = ret.items.slice(0, 3);
  const remaining = ret.items.length - visibleItems.length;
  const handleShare = async () => {
    const itemsText = ret.items
      .map(
        (it) =>
          `• ${it.material_name} ${it.qty_returned}/${it.qty_original} @₹${it.unit_cost} GST${it.tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase Return ${ret.return_number} from PixaPOS\nOriginal: ${ret.purchase_number} (${ret.purchase_id})\nSupplier: ${ret.supplier_name} (${ret.supplier_id})\nReason: ${ret.reason} ${ret.restock ? "(Restock)" : "(No restock)"}\n\nItems:\n${itemsText}\nRefund: ₹${ret.total_refund} (Sub ₹${ret.subtotal_refund} + GST ₹${ret.tax_refund})\nNotes: ${ret.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Return ${ret.return_number}`, text });
        toast.success("Return shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Return copied");
      } else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {}
  };
  return (
    <>
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve return {ret.return_number}?</DialogTitle>
            <DialogDescription>
              This will deduct stock{" "}
              {ret.restock ? `and create credit ₹${ret.total_refund}` : "(no stock change)"} —
              cannot be undone. Approved is posted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              Approve & Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel return {ret.return_number}?</DialogTitle>
            <DialogDescription>Only draft returns can be cancelled.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              Cancel Return
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/returns/${ret.id}`} className="underline">
            {ret.return_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">
            {new Date(ret.bill_date).toLocaleDateString()} •{" "}
            {ret.restock ? "Restock" : "No restock"}
          </div>
          <div className="text-[10px] text-muted-foreground capitalize">
            {ret.reason.replaceAll("_", " ")}
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/purchases/${ret.purchase_id}`} className="underline">
            {ret.purchase_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">{ret.purchase_id.slice(0, 8)}</div>
        </TableCell>
        <TableCell>
          <div className="text-xs">{ret.supplier_name}</div>
        </TableCell>
        <TableCell
          className="text-xs"
          title={ret.items
            .map((it) => `${it.material_name} ${it.qty_returned}/${it.qty_original}`)
            .join(", ")}
        >
          {visibleItems
            .map((it) => `${it.material_name} ${it.qty_returned}/${it.qty_original}`)
            .join(", ")}
          {remaining > 0 && <span className="text-muted-foreground"> +{remaining} more</span>}
        </TableCell>
        <TableCell>
          <div className="text-xs font-bold">₹{ret.total_refund.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">
            Sub ₹{ret.subtotal_refund} + GST ₹{ret.tax_refund}
          </div>
        </TableCell>
        <TableCell>
          <span className={`text-xs font-medium capitalize ${statusClass(ret.status)}`}>
            {ret.status}
          </span>
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
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/inventory/returns/${ret.id}`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare}>
                  <Icons.share className="mr-2 h-4 w-4" /> Share
                </DropdownMenuItem>
                {isDraft && (
                  <DropdownMenuItem onClick={() => setApproveOpen(true)}>
                    <Icons.check className="mr-2 h-4 w-4" /> Approve
                  </DropdownMenuItem>
                )}
                {isDraft && (
                  <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                    <Icons.trash className="mr-2 h-4 w-4" /> Cancel
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

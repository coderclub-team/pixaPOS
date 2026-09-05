"use client";
import type { Purchase } from "../api/types";
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
import {
  deletePurchase,
  clonePurchaseOrder,
  recordPurchasePayment,
  deletePurchase as deletePurchaseAlt,
} from "../api/service";
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
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";

function statusClass(s: string) {
  if (s === "paid") return "text-green-600";
  if (s === "partial") return "text-amber-600";
  return "text-destructive";
}

export function PurchaseList({ purchases }: { purchases: Purchase[] }) {
  if (purchases.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.fileTypePdf className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No purchases</p>
            <p className="text-sm text-muted-foreground">
              Record bill when goods received — linked to PO or direct. Stock adds on purchase.
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
              <TableHead>Purchase #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Due Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <PurchaseRow key={p.id} pur={p} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PurchaseRow({ pur }: { pur: Purchase }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payMode, setPayMode] = useState<string>("cash");

  const delMut = useMutation({
    mutationFn: (id: string) => deletePurchaseAlt(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cloneMut = useMutation({
    mutationFn: async (id: string) => {
      // clone via create from existing (purchase clone not exists, reuse logic: create new from same data)
      const { createPurchase } = await import("../api/service");
      return createPurchase({
        supplier_id: pur.supplier_id,
        items: pur.items as any,
        bill_date: new Date().toISOString().slice(0, 10),
        due_date: pur.due_date,
        paid_amount: 0,
        payment_mode: "credit",
        notes: pur.notes,
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
  const payMut = useMutation({
    mutationFn: () => recordPurchasePayment(pur.id, payAmt, payMode),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmt(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isEditable = pur.payment_status !== "paid";
  const isDeletable = pur.payment_status === "unpaid";
  const isPaid = pur.payment_status === "paid";
  const visibleItems = pur.items.slice(0, 3);
  const remaining = pur.items.length - visibleItems.length;
  const dueAmount = pur.total_amount - pur.paid_amount;
  const isOverdue =
    !!pur.due_date && dueAmount > 0 && new Date(pur.due_date) < new Date(new Date().toDateString());

  const handleShare = async () => {
    const itemsText = pur.items
      .map(
        (it) =>
          `• ${it.material_name ?? it.material_id} ${it.qty} @₹${it.unit_cost} GST${it.tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase ${pur.purchase_number} from PixaPOS\nSupplier: ${pur.supplier_name} (${pur.supplier_id})\nBill: ${new Date(pur.bill_date).toLocaleDateString()} Due: ${pur.due_date ? new Date(pur.due_date).toLocaleDateString() : "-"} PO: ${pur.po_number ?? "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${pur.subtotal} GST: ₹${pur.tax_amount} Total: ₹${pur.total_amount} Paid: ₹${pur.paid_amount}\nNotes: ${pur.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Purchase ${pur.purchase_number}`, text });
        toast.success("Purchase shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Purchase copied");
      } else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {}
  };

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete purchase?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {pur.purchase_number}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => delMut.mutate(pur.id)}
              disabled={delMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {pur.purchase_number}</DialogTitle>
            <DialogDescription>
              Balance ₹{(pur.total_amount - pur.paid_amount).toFixed(2)} • Total ₹{pur.total_amount}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium">Amount</div>
              <Input
                type="number"
                value={payAmt}
                onChange={(e) => setPayAmt(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium">Mode</div>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => payMut.mutate()} disabled={payMut.isPending || payAmt <= 0}>
              Pay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/purchases/${pur.id}`} className="underline">
            {pur.purchase_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">
            {new Date(pur.bill_date).toLocaleDateString()} • Due{" "}
            {pur.due_date ? new Date(pur.due_date).toLocaleDateString() : "-"}
          </div>
          {pur.po_number && (
            <div className="text-[10px] text-muted-foreground">PO {pur.po_number}</div>
          )}
          {(pur as any).reference && (
            <div className="text-[10px] text-muted-foreground">Inv {(pur as any).reference}</div>
          )}
        </TableCell>
        <TableCell>
          <div>{pur.supplier_name}</div>
          <div className="text-[10px] text-muted-foreground">
            Due {pur.due_date ? new Date(pur.due_date).toLocaleDateString() : "-"}
          </div>
        </TableCell>
        <TableCell
          className="text-xs"
          title={pur.items.map((it) => `${it.material_name} x${it.qty}`).join(", ")}
        >
          {visibleItems.map((it) => `${it.material_name} ×${it.qty}`).join(", ")}
          {remaining > 0 && <span className="text-muted-foreground"> +{remaining} more</span>}
        </TableCell>
        <TableCell>
          <div>₹{pur.total_amount}</div>
          <div className="text-[10px] text-muted-foreground">
            Sub ₹{pur.subtotal} + GST ₹{pur.tax_amount}
          </div>
        </TableCell>
        <TableCell>
          <span
            className={`text-xs font-bold ${dueAmount === 0 ? "text-green-600" : isOverdue ? "text-destructive" : "text-amber-600"}`}
          >
            {dueAmount === 0 ? "—" : `₹${dueAmount.toFixed(2)}`}
          </span>
          {dueAmount > 0 && (
            <div
              className={`text-[10px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
            >
              {isOverdue
                ? `Overdue • Due ${new Date(pur.due_date!).toLocaleDateString()}`
                : `Due ${pur.due_date ? new Date(pur.due_date).toLocaleDateString() : "-"}`}
            </div>
          )}
          {dueAmount === 0 && <div className="text-[10px] text-green-600">Paid</div>}
          <div className="text-[10px] text-muted-foreground">Bal Paid ₹{pur.paid_amount}</div>
        </TableCell>
        <TableCell>
          <span className={`text-xs font-medium capitalize ${statusClass(pur.payment_status)}`}>
            {pur.payment_status}
          </span>
          {pur.payment_mode && (
            <div className="text-[10px] text-muted-foreground capitalize">{pur.payment_mode}</div>
          )}
          {isOverdue && dueAmount > 0 && (
            <div className="text-[10px] text-destructive">Overdue</div>
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
                    onClick={() => router.push(`/dashboard/inventory/purchases/${pur.id}`)}
                  >
                    <Icons.edit className="mr-2 h-4 w-4" /> Update
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleShare}>
                  <Icons.share className="mr-2 h-4 w-4" /> Share
                </DropdownMenuItem>
                {!isPaid && (
                  <DropdownMenuItem onClick={() => setPayOpen(true)}>
                    <Icons.billing className="mr-2 h-4 w-4" /> Record Payment
                  </DropdownMenuItem>
                )}
                {isDeletable && (
                  <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                    <Icons.trash className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
                {isPaid && (
                  <DropdownMenuItem
                    onClick={() => cloneMut.mutate(pur.id)}
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

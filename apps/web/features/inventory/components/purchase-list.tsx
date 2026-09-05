"use client";
import type { Purchase } from "../api/types";
import { Badge } from "@pixa/ui/base-ui/badge";
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
import { deletePurchase } from "../api/service";
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

function paymentVariant(s: string) {
  if (s === "paid") return "default" as const;
  if (s === "partial") return "secondary" as const;
  return "destructive" as const;
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
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/dashboard/inventory/purchases/${p.id}`} className="underline">
                    {p.purchase_number}
                  </Link>
                  {p.po_number && (
                    <div className="text-[10px] text-muted-foreground">PO {p.po_number}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{p.supplier_name}</div>
                  {p.due_date && (
                    <div className="text-[10px] text-muted-foreground">
                      Due {new Date(p.due_date).toLocaleDateString()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {p.items.map((it) => `${it.material_name} x${it.qty}`).join(", ")}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">₹{p.total_amount}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Sub ₹{p.subtotal} + Tax ₹{p.tax_amount}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">₹{p.paid_amount}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Bal ₹{(p.total_amount - p.paid_amount).toFixed(2)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={paymentVariant(p.payment_status)} className="capitalize">
                    {p.payment_status}
                  </Badge>
                  {p.payment_mode && (
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {p.payment_mode}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(p.bill_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/dashboard/inventory/purchases/${p.id}`}>
                      <Button variant="ghost" size="icon-sm" aria-label="View">
                        <Icons.externalLink className="size-4" />
                      </Button>
                    </Link>
                    <PurchaseRowActions pur={p} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PurchaseRowActions({ pur }: { pur: Purchase }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const delMut = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const isEditable = pur.payment_status !== "paid";
  const isDeletable = pur.payment_status !== "paid";
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
                onClick={() => router.push(`/dashboard/inventory/purchases/${pur.id}/edit`)}
              >
                <Icons.edit className="mr-2 h-4 w-4" /> Update
              </DropdownMenuItem>
            )}
            {isDeletable && (
              <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                <Icons.trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
            {!isEditable && !isDeletable && (
              <DropdownMenuItem disabled>No actions</DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

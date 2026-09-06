"use client";
import type { SupplierAdjustment } from "../api/types";
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
import { cancelSupplierAdjustment } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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

function statusClass(s: string) {
  if (s === "posted" || s === "applied") return "text-green-600";
  return "text-destructive";
}

export function SupplierAdjustmentList({ adjustments }: { adjustments: SupplierAdjustment[] }) {
  if (adjustments.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.billing className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No credits / debits</p>
            <p className="text-sm text-muted-foreground">
              Create CN-SUP for vendor credits (rate diff, shortage, discount) or DN-SUP for extra
              charges. Financial-only, no stock.
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
              <TableHead>Adjustment #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Linked Purchase</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((a) => (
              <Row key={a.id} adj={a} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Row({ adj }: { adj: SupplierAdjustment }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancelMut = useMutation({
    mutationFn: () => cancelSupplierAdjustment(adj.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Adjustment cancelled");
      setCancelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const isEditable =
    adj.status !== "cancelled" && adj.status !== "applied" && (adj.applied_amount ?? 0) === 0;
  const avail = adj.amount - (adj.applied_amount ?? 0);
  return (
    <>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {adj.adjustment_number}?</DialogTitle>
            <DialogDescription>
              Cancel removes this credit/debit. Only unused can be cancelled.
            </DialogDescription>
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
              Cancel Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/supplier-credits/${adj.id}`} className="underline">
            {adj.adjustment_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">
            {new Date(adj.bill_date).toLocaleDateString()}{" "}
            {adj.reference ? `• ${adj.reference}` : ""}
          </div>
        </TableCell>
        <TableCell>
          <span
            className={`text-xs font-medium capitalize ${adj.type === "credit" ? "text-green-600" : "text-destructive"}`}
          >
            {adj.type}
          </span>
        </TableCell>
        <TableCell className="text-xs">{adj.supplier_name}</TableCell>
        <TableCell className="font-mono text-xs">
          {adj.purchase_number ? (
            <Link href={`/dashboard/inventory/purchases/${adj.purchase_id}`} className="underline">
              {adj.purchase_number}
            </Link>
          ) : (
            <span className="text-muted-foreground">— standalone</span>
          )}
        </TableCell>
        <TableCell className="text-xs capitalize">{adj.category.replaceAll("_", " ")}</TableCell>
        <TableCell className="text-xs font-bold">
          ₹{adj.amount.toFixed(2)}
          {adj.applied_amount !== undefined && adj.applied_amount > 0 ? (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              • Applied ₹{adj.applied_amount.toFixed(2)} • Avail ₹{avail.toFixed(2)}
            </span>
          ) : null}
        </TableCell>
        <TableCell>
          <span className={`text-xs font-medium capitalize ${statusClass(adj.status)}`}>
            {adj.status}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
              <Icons.ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/inventory/supplier-credits/${adj.id}`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                {isEditable && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/dashboard/inventory/supplier-credits/${adj.id}/edit`)
                    }
                  >
                    <Icons.edit className="mr-2 h-4 w-4" /> Update
                  </DropdownMenuItem>
                )}
                {isEditable && (
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

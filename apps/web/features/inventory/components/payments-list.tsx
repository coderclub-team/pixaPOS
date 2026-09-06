"use client";
import type { SupplierPayment } from "../api/types";
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
import { cancelPayment } from "../api/service";
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
  if (s === "posted") return "text-green-600";
  return "text-destructive";
}

export function PaymentsList({ payments }: { payments: SupplierPayment[] }) {
  if (payments.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.billing className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No payments</p>
            <p className="text-sm text-muted-foreground">
              Record payment for a purchase bill or advance to supplier. Financial-only, purchase
              optional.
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
              <TableHead>Payment #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Linked Purchase</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <Row key={p.id} pay={p} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Row({ pay }: { pay: SupplierPayment }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancelMut = useMutation({
    mutationFn: () => cancelPayment(pay.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Payment cancelled and reversed");
      setCancelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {pay.payment_number}?</DialogTitle>
            <DialogDescription>
              Cancelling reverses purchase paid_amount if linked. Only posted can be cancelled.
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
              Cancel Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <Link href={`/dashboard/inventory/payments/${pay.id}`} className="underline">
            {pay.payment_number}
          </Link>
          <div className="text-[10px] text-muted-foreground">
            {new Date(pay.bill_date).toLocaleDateString()}{" "}
            {pay.reference ? `• ${pay.reference}` : ""}
          </div>
        </TableCell>
        <TableCell className="text-xs">{pay.supplier_name}</TableCell>
        <TableCell className="font-mono text-xs">
          {pay.purchase_number ? (
            <Link href={`/dashboard/inventory/purchases/${pay.purchase_id}`} className="underline">
              {pay.purchase_number}
            </Link>
          ) : (
            <span className="text-muted-foreground">— advance</span>
          )}
        </TableCell>
        <TableCell className="text-xs font-bold">₹{pay.amount.toFixed(2)}</TableCell>
        <TableCell className="text-xs capitalize">{pay.payment_mode}</TableCell>
        <TableCell>
          <span className={`text-xs font-medium capitalize ${statusClass(pay.status)}`}>
            {pay.status}
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
                  onClick={() => router.push(`/dashboard/inventory/payments/${pay.id}`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                  <Icons.trash className="mr-2 h-4 w-4" /> Cancel
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </>
  );
}

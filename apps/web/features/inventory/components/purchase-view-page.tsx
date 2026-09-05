"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { purchaseQueryOptions } from "../api/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { useMutation } from "@tanstack/react-query";
import { recordPurchasePayment } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";

function statusVariant(s: string) {
  if (s === "paid") return "default" as const;
  if (s === "partial") return "secondary" as const;
  return "destructive" as const;
}

export default function PurchaseViewPage({ purchaseId }: { purchaseId: string }) {
  const { data: p } = useSuspenseQuery(purchaseQueryOptions(purchaseId));
  if (!p) notFound();
  const [payAmt, setPayAmt] = useState(0);
  const [payMode, setPayMode] = useState("cash");
  const payMut = useMutation({
    mutationFn: () => recordPurchasePayment(p.id, payAmt, payMode),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Payment recorded");
      setPayAmt(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Purchase {p.purchase_number}</span>
            <Badge variant={statusVariant(p.payment_status)} className="capitalize">
              {p.payment_status}
            </Badge>
          </CardTitle>
          <CardDescription>
            Supplier: {p.supplier_name} ({p.supplier_id}) • Bill{" "}
            {new Date(p.bill_date).toLocaleDateString()}
            {p.due_date && ` • Due ${new Date(p.due_date).toLocaleDateString()}`}
            {p.po_number && ` • PO ${p.po_number}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-xs">
            <div>
              Subtotal ₹{p.subtotal} + GST ₹{p.tax_amount} = Total ₹{p.total_amount}
            </div>
            <div>
              Paid ₹{p.paid_amount} • Balance ₹{(p.total_amount - p.paid_amount).toFixed(2)} • Mode{" "}
              {p.payment_mode ?? "-"}
            </div>
            {p.notes && <div>Notes: {p.notes}</div>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>GST %</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>{it.material_name ?? it.material_id}</TableCell>
                  <TableCell>{it.qty}</TableCell>
                  <TableCell>₹{it.unit_cost}</TableCell>
                  <TableCell>{it.tax_percent ?? 0}%</TableCell>
                  <TableCell>₹{(it.qty * it.unit_cost).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-right font-bold">Total: ₹{p.total_amount} (incl. GST)</div>
          {p.payment_status !== "paid" && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="space-y-1">
                <div className="text-xs font-medium">Record Payment</div>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={payAmt}
                  onChange={(e) => setPayAmt(Number(e.target.value))}
                  className="w-32"
                />
              </div>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => payMut.mutate()} disabled={payMut.isPending || payAmt <= 0}>
                Pay
              </Button>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/dashboard/inventory/purchases">
              <Button variant="outline">Back</Button>
            </Link>
            {p.payment_status !== "paid" && (
              <Link href={`/dashboard/inventory/purchases/${p.id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

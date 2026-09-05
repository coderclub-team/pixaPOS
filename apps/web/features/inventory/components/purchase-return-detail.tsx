"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { purchaseReturnQueryOptions, inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { approvePurchaseReturn, cancelPurchaseReturn } from "../api/service";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Icons } from "@pixa/ui/icons";

export default function PurchaseReturnDetail({ returnId }: { returnId: string }) {
  const router = useRouter();
  const { data: r, isPending } = useQuery(purchaseReturnQueryOptions(returnId));
  const approveMut = useMutation({
    mutationFn: () => approvePurchaseReturn(returnId),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Return approved — stock deducted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelPurchaseReturn(returnId),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Return cancelled");
      router.push("/dashboard/inventory/returns");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!r)
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-8 text-center">
        <p className="font-medium">Return not found</p>
        <p className="text-sm text-muted-foreground">{returnId}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/dashboard/inventory/returns">
            <Button variant="outline">Back to returns</Button>
          </Link>
        </div>
      </div>
    );
  const isDraft = r.status === "draft";
  const handleShare = async () => {
    const text = `Return ${r.return_number} — ${r.purchase_number}\nSupplier ${r.supplier_name}\nRefund ₹${r.total_refund} Reason ${r.reason}`;
    try {
      if (navigator.share) await navigator.share({ title: r.return_number, text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Shared");
    } catch {}
  };
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {r.return_number}{" "}
              <span className="text-sm font-normal capitalize text-muted-foreground">
                • {r.status} • {r.reason}
              </span>
            </span>
            <span className="text-sm font-bold">₹{r.total_refund}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Original{" "}
            <Link href={`/dashboard/inventory/purchases/${r.purchase_id}`} className="underline">
              {r.purchase_number}
            </Link>{" "}
            • Supplier {r.supplier_name} • {new Date(r.bill_date).toLocaleDateString()} •{" "}
            {r.restock ? "Restock" : "No restock"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Qty Returned / Original</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.items.map((it) => (
                <TableRow key={it.material_id}>
                  <TableCell>{it.material_name}</TableCell>
                  <TableCell>
                    {it.qty_returned} / {it.qty_original}
                  </TableCell>
                  <TableCell>
                    ₹{it.unit_cost} GST {it.tax_percent ?? 0}%
                  </TableCell>
                  <TableCell>₹{it.line_refund?.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{r.subtotal_refund}</span>
            </div>
            <div className="flex justify-between">
              <span>GST</span>
              <span>₹{r.tax_refund}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total Refund</span>
              <span>₹{r.total_refund}</span>
            </div>
          </div>
          {r.notes && <p className="text-sm">Notes: {r.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Icons.share className="mr-1 h-4 w-4" /> Share
            </Button>
            {isDraft && (
              <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                <Icons.check className="mr-1 h-4 w-4" /> Approve & Post
              </Button>
            )}
            {isDraft && (
              <Button
                variant="destructive"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
              >
                <Icons.trash className="mr-1 h-4 w-4" /> Cancel Return
              </Button>
            )}
            <Button variant="ghost" onClick={() => router.push("/dashboard/inventory/returns")}>
              Back to list
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

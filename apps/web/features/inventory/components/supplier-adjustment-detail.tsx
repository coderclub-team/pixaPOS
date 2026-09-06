"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  supplierAdjustmentQueryOptions,
  inventoryKeys,
  purchasesQueryOptions,
} from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { cancelSupplierAdjustment, applySupplierCredit } from "../api/service";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Label } from "@pixa/ui/base-ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Icons } from "@pixa/ui/icons";
import { useState } from "react";

export default function SupplierAdjustmentDetail({ adjustmentId }: { adjustmentId: string }) {
  const router = useRouter();
  const { data: adj, isPending } = useQuery(supplierAdjustmentQueryOptions(adjustmentId));
  const { data: purchases } = useQuery(purchasesQueryOptions());
  const [applyPurchaseId, setApplyPurchaseId] = useState("");
  const [applyAmount, setApplyAmount] = useState<number>(0);

  const cancelMut = useMutation({
    mutationFn: () => cancelSupplierAdjustment(adjustmentId),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Cancelled");
      router.push("/dashboard/inventory/supplier-credits");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const applyMut = useMutation({
    mutationFn: () => applySupplierCredit(adjustmentId, applyPurchaseId, Number(applyAmount)),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Credit applied to purchase");
      setApplyAmount(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!adj)
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-8 text-center">
        <p className="font-medium">Adjustment not found</p>
        <Link href="/dashboard/inventory/supplier-credits">
          <Button variant="outline">Back to credits</Button>
        </Link>
      </div>
    );
  const isEditable =
    adj.status !== "cancelled" && adj.status !== "applied" && (adj.applied_amount ?? 0) === 0;
  const isCredit = adj.type === "credit";
  const canApply = (adj.status === "posted" || adj.status === "applied") && isCredit;
  const avail = adj.amount - (adj.applied_amount ?? 0);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {adj.adjustment_number}{" "}
              <span className="text-sm font-normal capitalize text-muted-foreground">
                • {adj.type} • {adj.category.replaceAll("_", " ")} • {adj.status}
              </span>
            </span>
            <span
              className={`text-sm font-bold ${adj.type === "credit" ? "text-green-600" : "text-destructive"}`}
            >
              ₹{adj.amount.toFixed(2)}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Supplier {adj.supplier_name} • {new Date(adj.bill_date).toLocaleDateString()}{" "}
            {adj.reference ? `• Ref ${adj.reference}` : ""}{" "}
            {adj.purchase_number ? (
              <>
                • Linked{" "}
                <Link
                  href={`/dashboard/inventory/purchases/${adj.purchase_id}`}
                  className="underline"
                >
                  {adj.purchase_number}
                </Link>
              </>
            ) : (
              "• Standalone (no purchase)"
            )}{" "}
            {adj.applied_amount !== undefined
              ? `• Applied ₹${adj.applied_amount} • Avail ₹${avail.toFixed(2)}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {adj.notes && <p className="text-sm">Notes: {adj.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const text = `${adj.adjustment_number} ${adj.type} ${adj.supplier_name} ₹${adj.amount} ${adj.category}`;
                try {
                  if (navigator.share)
                    await navigator.share({ title: adj.adjustment_number, text });
                  else if (navigator.clipboard) await navigator.clipboard.writeText(text);
                  else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  toast.success("Shared");
                } catch {}
              }}
            >
              <Icons.share className="mr-1 h-4 w-4" /> Share
            </Button>
            {isEditable && (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/inventory/supplier-credits/${adj.id}/edit`)}
              >
                <Icons.edit className="mr-1 h-4 w-4" /> Update
              </Button>
            )}
            {isEditable && (
              <Button
                variant="destructive"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
              >
                <Icons.trash className="mr-1 h-4 w-4" /> Cancel
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/inventory/supplier-credits")}
            >
              Back to list
            </Button>
          </div>

          {isCredit && canApply && avail > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply to Purchase (Zoho Apply Credits)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Purchase</Label>
                    <Select value={applyPurchaseId} onValueChange={setApplyPurchaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select PUR-" />
                      </SelectTrigger>
                      <SelectContent>
                        {(purchases ?? [])
                          .filter(
                            (p) => p.supplier_id === adj.supplier_id && p.payment_status !== "paid",
                          )
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.purchase_number} — Due ₹
                              {(p.total_amount - p.paid_amount).toFixed(2)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (avail ₹{avail.toFixed(2)})</Label>
                    <Input
                      type="number"
                      value={applyAmount as any}
                      onChange={(e) => setApplyAmount(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => applyMut.mutate()}
                      disabled={
                        applyMut.isPending ||
                        !applyPurchaseId ||
                        applyAmount <= 0 ||
                        applyAmount > avail
                      }
                    >
                      Apply Credit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

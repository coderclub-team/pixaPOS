"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { paymentQueryOptions, inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { cancelPayment } from "../api/service";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Icons } from "@pixa/ui/icons";

export default function PaymentDetail({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const { data: pay, isPending } = useQuery(paymentQueryOptions(paymentId));
  const cancelMut = useMutation({
    mutationFn: () => cancelPayment(paymentId),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Payment cancelled and reversed");
      router.push("/dashboard/inventory/payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!pay)
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-8 text-center">
        <p className="font-medium">Payment not found</p>
        <Link href="/dashboard/inventory/payments">
          <Button variant="outline">Back to payments</Button>
        </Link>
      </div>
    );
  const isPosted = pay.status === "posted";
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {pay.payment_number}{" "}
              <span className="text-sm font-normal capitalize text-muted-foreground">
                • {pay.payment_mode} • {pay.status}
              </span>
            </span>
            <span className="text-sm font-bold">₹{pay.amount.toFixed(2)}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Supplier {pay.supplier_name} • {new Date(pay.bill_date).toLocaleDateString()}{" "}
            {pay.reference ? `• Ref ${pay.reference}` : ""}{" "}
            {pay.purchase_number ? (
              <>
                • Linked{" "}
                <Link
                  href={`/dashboard/inventory/purchases/${pay.purchase_id}`}
                  className="underline"
                >
                  {pay.purchase_number}
                </Link>
              </>
            ) : (
              "• Advance"
            )}{" "}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {pay.notes && <p className="text-sm">Notes: {pay.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {isPosted && (
              <Button
                variant="destructive"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
              >
                <Icons.trash className="mr-1 h-4 w-4" /> Cancel & Reverse
              </Button>
            )}
            <Button variant="ghost" onClick={() => router.push("/dashboard/inventory/payments")}>
              Back to list
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

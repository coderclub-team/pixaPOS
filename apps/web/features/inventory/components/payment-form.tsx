"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createPayment } from "../api/service";
import { inventoryKeys, suppliersQueryOptions, purchasesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";

const modeOptions = [
  { label: "Cash", value: "cash" },
  { label: "UPI", value: "upi" },
  { label: "Bank", value: "bank" },
  { label: "Credit", value: "credit" },
] as const;

export default function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSupplierId = searchParams.get("supplierId") ?? "";
  const prePurchaseId = searchParams.get("purchaseId") ?? "";
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: purchases } = useQuery(purchasesQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} (${s.phone})`,
    value: s.id,
  }));
  const purchaseOptions = (purchases ?? []).map((p) => ({
    label: `${p.purchase_number} — ${p.supplier_name} Due ₹${(p.total_amount - p.paid_amount).toFixed(2)}`,
    value: p.id,
  }));

  const createMut = useMutation({
    mutationFn: (v: any) => createPayment(v),
    onSuccess: (pay) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`${pay.payment_number} posted`);
      router.push("/dashboard/inventory/payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      supplier_id: preSupplierId,
      purchase_id: prePurchaseId,
      amount: 0 as any,
      payment_mode: "bank" as any,
      bill_date: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.supplier_id) return { supplier_id: "Supplier required" } as any;
        if (!value.amount || Number(value.amount) <= 0) return { amount: "Amount > 0" } as any;
        if (!value.bill_date) return { bill_date: "Date required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        amount: Number(value.amount),
        purchase_id: value.purchase_id || null,
      };
      await createMut.mutateAsync(payload);
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">New Payment</CardTitle>
            <CardDescription>
              Pay a purchase bill or advance to supplier. Purchase optional. Single posted, cancel
              to reverse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="supplier_id"
                  children={(field) => (
                    <field.SelectField
                      label="Supplier *"
                      required
                      options={supplierOptions}
                      placeholder="Select supplier"
                    />
                  )}
                />
                <form.AppField
                  name="payment_mode"
                  children={(field) => (
                    <field.SelectField
                      label="Mode *"
                      required
                      options={modeOptions as any}
                      placeholder="Select mode"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="purchase_id"
                  children={(field) => (
                    <field.SelectField
                      label="Link Purchase (optional)"
                      options={purchaseOptions}
                      placeholder="Select PUR- for bill or leave for advance"
                      description="Due is checked if linked"
                    />
                  )}
                />
                <form.AppField
                  name="amount"
                  children={(field) => (
                    <field.TextField
                      label="Amount *"
                      type="number"
                      placeholder="1000"
                      description="≤ Due if linked"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="bill_date"
                  children={(field) => <field.TextField label="Date *" type="date" required />}
                />
                <form.AppField
                  name="reference"
                  children={(field) => (
                    <field.TextField
                      label="Reference"
                      placeholder="UTR / txn id"
                      description="Bank UPI ref"
                    />
                  )}
                />
              </div>
              <form.AppField
                name="notes"
                children={(field) => (
                  <field.TextareaField label="Notes" placeholder="Payment notes" rows={2} />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <form.AppForm children={<form.SubmitButton>Create & Post</form.SubmitButton>} />
        </div>
      </form>
    </div>
  );
}

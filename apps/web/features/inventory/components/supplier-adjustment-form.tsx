"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createSupplierAdjustment, updateSupplierAdjustment } from "../api/service";
import { inventoryKeys, suppliersQueryOptions, purchasesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { SupplierAdjustment } from "../api/types";
import { useState } from "react";

const typeOptions = [
  { label: "Credit — vendor owes you", value: "credit" },
  { label: "Debit — you owe extra", value: "debit" },
] as const;
const categoryOptions = [
  { label: "Rate Difference", value: "rate_difference" },
  { label: "Discount", value: "discount" },
  { label: "Shortage", value: "shortage" },
  { label: "Freight", value: "freight" },
  { label: "Tax Correction", value: "tax_correction" },
  { label: "Opening Balance", value: "opening_balance" },
  { label: "Other", value: "other" },
] as const;

export default function SupplierAdjustmentForm({
  initialData,
  pageTitle,
}: {
  initialData?: SupplierAdjustment | null;
  pageTitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSupplierId = initialData?.supplier_id ?? searchParams.get("supplierId") ?? "";
  const prePurchaseId = initialData?.purchase_id ?? searchParams.get("purchaseId") ?? "";
  const isEdit = !!initialData;
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: purchases } = useQuery(purchasesQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} (${s.phone})`,
    value: s.id,
  }));
  const purchaseOptions = (purchases ?? []).map((p) => ({
    label: `${p.purchase_number} — ${p.supplier_name}`,
    value: p.id,
  }));

  const [saveMode, setSaveMode] = useState<"draft" | "posted">("draft");
  const createMut = useMutation({
    mutationFn: (v: any) => createSupplierAdjustment(v),
    onSuccess: (adj) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      const isPosted = adj.status === "posted";
      toast.success(
        isPosted
          ? `${adj.adjustment_number} posted and ready to apply`
          : `${adj.adjustment_number} saved as draft`,
      );
      router.push("/dashboard/inventory/supplier-credits");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: any) => updateSupplierAdjustment(initialData!.id, v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Adjustment updated");
      router.push("/dashboard/inventory/supplier-credits");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      supplier_id: initialData?.supplier_id ?? preSupplierId,
      type: (initialData?.type as any) ?? ("credit" as any),
      category: (initialData?.category as any) ?? ("" as any),
      purchase_id: (initialData?.purchase_id as any) ?? prePurchaseId,
      amount: (initialData?.amount as any) ?? (0 as any),
      bill_date: initialData?.bill_date ?? new Date().toISOString().slice(0, 10),
      reference: initialData?.reference ?? "",
      notes: initialData?.notes ?? "",
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.supplier_id) return { supplier_id: "Supplier required" } as any;
        if (!value.type) return { type: "Type required" } as any;
        if (!value.category) return { category: "Category required" } as any;
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
        saveMode,
        status: saveMode,
      } as any;
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
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
            <CardTitle className="text-left text-2xl font-bold">
              {pageTitle ?? (isEdit ? "Update Adjustment" : "New Supplier Adjustment")}
            </CardTitle>
            <CardDescription>
              Credit (vendor owes you) / Debit (you owe extra) — financial only, no stock. Purchase
              optional.
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
                  name="type"
                  children={(field) => (
                    <field.SelectField
                      label="Type *"
                      required
                      options={typeOptions as any}
                      placeholder="Select credit/debit"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="category"
                  children={(field) => (
                    <field.SelectField
                      label="Category *"
                      required
                      options={categoryOptions as any}
                      placeholder="Select category"
                    />
                  )}
                />
                <form.AppField
                  name="amount"
                  children={(field) => (
                    <field.TextField
                      label="Amount *"
                      type="number"
                      placeholder="500"
                      description="Total including tax, amount vendor owes (credit) or you owe (debit)"
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
                      placeholder="Standalone or select PUR-..."
                      description="Leave empty for opening balance / advance"
                    />
                  )}
                />
                <form.AppField
                  name="bill_date"
                  children={(field) => <field.TextField label="Date *" type="date" required />}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="reference"
                  children={(field) => (
                    <field.TextField
                      label="Reference"
                      placeholder="CN-001 / vendor note"
                      description="External credit note no"
                    />
                  )}
                />
                <form.AppField
                  name="notes"
                  children={(field) => (
                    <field.TextareaField
                      label="Notes"
                      placeholder="Rate diff 80→78, short 2kg, freight extra"
                      rows={2}
                    />
                  )}
                />
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          {isEdit ? (
            <form.AppForm children={<form.SubmitButton>Update</form.SubmitButton>} />
          ) : (
            <>
              <Button
                type="submit"
                variant="outline"
                disabled={createMut.isPending}
                onClick={() => setSaveMode("draft")}
              >
                Save as Draft
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending}
                onClick={() => setSaveMode("posted")}
              >
                Save & Post
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { rawMaterialSchema, type RawMaterialValues } from "../schemas/raw-material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRawMaterial, updateRawMaterial } from "../api/service";
import { inventoryKeys, suppliersQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { RawMaterial } from "../api/types";

const unitOptions = [
  { label: "Kilogram (kg)", value: "kg" },
  { label: "Gram (g)", value: "g" },
  { label: "Litre (l)", value: "l" },
  { label: "Millilitre (ml)", value: "ml" },
  { label: "Pieces (pcs)", value: "pcs" },
  { label: "Box", value: "box" },
];

const categoryOptions = [
  { label: "Vegetables", value: "Vegetables" },
  { label: "Grains", value: "Grains" },
  { label: "Meat", value: "Meat" },
  { label: "Dairy", value: "Dairy" },
  { label: "Oil", value: "Oil" },
  { label: "Spices", value: "Spices" },
  { label: "Beverages", value: "Beverages" },
  { label: "General", value: "General" },
];

export default function RawMaterialForm({
  initialData,
  pageTitle,
}: {
  initialData: RawMaterial | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} (${s.phone})`,
    value: s.id,
  }));

  const createMutation = useMutation({
    mutationFn: (v: RawMaterialValues) => createRawMaterial(v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Raw material created");
      router.push("/dashboard/inventory/raw-materials");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: (v: RawMaterialValues) => updateRawMaterial(initialData!.id, v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Raw material updated");
      router.push("/dashboard/inventory/raw-materials");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      sku: initialData?.sku ?? "",
      category: initialData?.category ?? "General",
      unit: initialData?.unit ?? "kg",
      stock_qty: initialData?.stock_qty ?? 0,
      low_stock_threshold: initialData?.low_stock_threshold ?? 5,
      cost_price: initialData?.cost_price ?? 0,
      supplier_id: initialData?.supplier_id ?? "",
      is_active: initialData?.is_active ?? true,
    } as RawMaterialValues,
    validators: { onSubmit: rawMaterialSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField label="Material Name" required placeholder="Basmati Rice" />
                )}
              />
              <form.AppField
                name="sku"
                children={(field) => (
                  <field.TextField label="SKU" required placeholder="RM-RICE-001" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="category"
                children={(field) => (
                  <field.SelectField
                    label="Category"
                    required
                    options={categoryOptions}
                    placeholder="Select category"
                  />
                )}
              />
              <form.AppField
                name="unit"
                children={(field) => (
                  <field.SelectField
                    label="Unit"
                    required
                    options={unitOptions}
                    placeholder="Select unit"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="stock_qty"
                children={(field) => (
                  <field.TextField label="Stock Qty" type="number" placeholder="0" />
                )}
              />
              <form.AppField
                name="low_stock_threshold"
                children={(field) => (
                  <field.TextField label="Low Stock Alert" type="number" placeholder="5" />
                )}
              />
              <form.AppField
                name="cost_price"
                children={(field) => (
                  <field.TextField label="Cost Price" type="number" placeholder="0" />
                )}
              />
            </div>
            <form.AppField
              name="supplier_id"
              children={(field) => (
                <field.SelectField
                  label="Supplier"
                  options={supplierOptions}
                  placeholder="Select supplier"
                />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField label="Active" description="Available for recipes" />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={<form.SubmitButton>{isEdit ? "Update" : "Create"}</form.SubmitButton>}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

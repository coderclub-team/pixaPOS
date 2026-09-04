"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
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

const taxTypeOptions = [
  { label: "GST", value: "GST" },
  { label: "VAT", value: "VAT" },
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
    mutationFn: (v: RawMaterialValues) => createRawMaterial(v as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Raw material created");
      router.push("/dashboard/inventory/raw-materials");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: (v: RawMaterialValues) => updateRawMaterial(initialData!.id, v as any),
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
      opening_stock: initialData?.opening_stock ?? 0,
      cost_price: initialData?.cost_price ?? 0,
      tax_type: initialData?.tax_type ?? "GST",
      tax_percent: initialData?.tax_percent ?? 5,
      hsn_code: initialData?.hsn_code ?? "",
      barcode: initialData?.barcode ?? "",
      supplier_id: initialData?.supplier_id ?? "",
      is_active: initialData?.is_active ?? true,
      is_expiry: initialData?.is_expiry ?? false,
      allow_decimal: initialData?.allow_decimal ?? true,
      exclusive: initialData?.exclusive ?? false,
      normal_loss_percent: initialData?.normal_loss_percent ?? 0,
      description: initialData?.description ?? "",
    } as RawMaterialValues,
    validators: { onSubmit: rawMaterialSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
          <CardDescription>
            Ingredients with purchase, consumption and stock linkage. Use 0.05 kg for 50g.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            {/* Basic Details */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Basic Details</h3>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <form.AppField
                    name="name"
                    children={(field) => (
                      <field.TextField label="Name *" required placeholder="Basmati Rice" />
                    )}
                  />
                  <form.AppField
                    name="sku"
                    children={(field) => (
                      <field.TextField label="Code / SKU *" required placeholder="RM-RICE-001" />
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                        label="Unit *"
                        required
                        options={unitOptions}
                        placeholder="kg"
                        description="Use 0.05 for 50g"
                      />
                    )}
                  />
                  <form.AppField
                    name="cost_price"
                    children={(field) => (
                      <field.TextField
                        label="Purchase Price *"
                        type="number"
                        placeholder="80"
                        description={
                          initialData
                            ? `Avg ₹${initialData.avg_cost} • Δ ${initialData.avg_cost ? (((initialData.cost_price - initialData.avg_cost) / initialData.avg_cost) * 100).toFixed(1) : 0}%`
                            : "Last purchase price; avg auto-updates on PO"
                        }
                      />
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <form.AppField
                    name="supplier_id"
                    children={(field) => (
                      <field.SelectField
                        label="Preferred Supplier"
                        options={supplierOptions}
                        placeholder="Select supplier"
                        description="Can be purchased from multiple vendors; last rates tracked per PO, transfer uses last price"
                      />
                    )}
                  />
                  <div className="hidden md:block" />
                </div>
              </FieldGroup>
            </div>

            {/* Tax */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Tax</h3>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <form.AppField
                    name="tax_type"
                    children={(field) => (
                      <field.SelectField
                        label="Tax Type"
                        options={taxTypeOptions}
                        placeholder="GST"
                      />
                    )}
                  />
                  <form.AppField
                    name="tax_percent"
                    children={(field) => (
                      <field.TextField label="Tax (%)" type="number" placeholder="5" />
                    )}
                  />
                  <form.AppField
                    name="hsn_code"
                    children={(field) => (
                      <field.TextField
                        label="HSN Code"
                        placeholder="10063010"
                        description="4-8 digits"
                      />
                    )}
                  />
                </div>
              </FieldGroup>
            </div>

            {/* Stock / Inventory */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Stock / Inventory</h3>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <form.AppField
                    name="opening_stock"
                    children={(field) => (
                      <field.TextField label="Opening Stock" type="number" placeholder="0" />
                    )}
                  />
                  <form.AppField
                    name="stock_qty"
                    children={(field) => (
                      <field.TextField
                        label="Current Stock"
                        type="number"
                        placeholder="0"
                        description="Use PO for stock in"
                      />
                    )}
                  />
                  <form.AppField
                    name="low_stock_threshold"
                    children={(field) => (
                      <field.TextField
                        label="Low Stock Threshold *"
                        type="number"
                        placeholder="5"
                        description="Alert when stock ≤ threshold"
                      />
                    )}
                  />
                </div>
                {initialData && (
                  <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                    <div>
                      Average Purchase Price: ₹{initialData.avg_cost} • Valuation: ₹
                      {(initialData.stock_qty * initialData.avg_cost).toFixed(2)}
                    </div>
                    <div className="mt-1">
                      WAC: (old_avg×old_qty + new_cost×qty)/total. Transfer uses last purchase
                      price.
                    </div>
                  </div>
                )}
              </FieldGroup>
            </div>

            {/* Related Codes */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Related Codes</h3>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <form.AppField
                    name="barcode"
                    children={(field) => (
                      <field.TextField
                        label="Barcode / Short Code"
                        placeholder="8901234567890"
                        description="8-14 digits, GS1"
                      />
                    )}
                  />
                  <div className="hidden md:block" />
                </div>
              </FieldGroup>
            </div>

            {/* Other Details */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Other Details</h3>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <form.AppField
                    name="exclusive"
                    children={(field) => <field.SwitchField label="Exclusive to This Restaurant" />}
                  />
                  <form.AppField
                    name="is_expiry"
                    children={(field) => (
                      <field.SwitchField label="Is Expiry" description="Perishable" />
                    )}
                  />
                  <form.AppField
                    name="allow_decimal"
                    children={(field) => (
                      <field.SwitchField
                        label="Allow Decimal Quantity"
                        description="Allows 0.05 kg for 50g"
                      />
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <form.AppField
                    name="normal_loss_percent"
                    children={(field) => (
                      <field.TextField label="Normal Loss (%)" type="number" placeholder="2" />
                    )}
                  />
                  <form.AppField
                    name="is_active"
                    children={(field) => (
                      <field.SwitchField label="Active" description="Available for recipes" />
                    )}
                  />
                </div>
                <form.AppField
                  name="description"
                  children={(field) => (
                    <field.TextareaField
                      label="Description"
                      placeholder="Premium basmati for biryani"
                      rows={2}
                    />
                  )}
                />
              </FieldGroup>
            </div>

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

      {initialData?.suppliers && initialData.suppliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Pricing (Multi-vendor)</CardTitle>
            <CardDescription>
              Last rates per supplier — updated on PO receive. Purchase from different vendors
              tracked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {initialData.suppliers.map((s) => (
                <div
                  key={s.supplier_id}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <span>
                    {s.supplier_name} ({s.supplier_id})
                  </span>
                  <span className="font-mono">
                    ₹{s.last_rate}{" "}
                    {s.is_preferred && (
                      <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                        Preferred
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

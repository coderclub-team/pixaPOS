"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPurchaseOrder } from "../api/service";
import { inventoryKeys, rawMaterialsQueryOptions, suppliersQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import * as z from "zod";

const poSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(1),
  unit_cost: z.number().min(0),
  expected_at: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export default function PurchaseOrderForm({ pageTitle }: { pageTitle: string }) {
  const router = useRouter();
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({ label: s.name, value: s.id }));
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku})`,
    value: m.id,
  }));
  const mutation = useMutation({
    mutationFn: (v: any) =>
      createPurchaseOrder({
        supplier_id: v.supplier_id,
        items: [{ material_id: v.material_id, qty: v.qty, unit_cost: v.unit_cost }],
        expected_at: v.expected_at || undefined,
        notes: v.notes,
      } as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase order created as draft — not yet added to inventory");
      router.push("/dashboard/inventory/purchase-orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const form = useAppForm({
    defaultValues: {
      supplier_id: "",
      material_id: "",
      qty: 10,
      unit_cost: 0,
      expected_at: "",
      notes: "",
    } as any,
    validators: { onSubmit: poSchema },
    onSubmit: async ({ value }) => mutation.mutateAsync(value),
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
            <form.AppField
              name="supplier_id"
              children={(field) => (
                <field.SelectField
                  label="Supplier"
                  required
                  options={supplierOptions}
                  placeholder="Select supplier"
                />
              )}
            />
            <form.AppField
              name="material_id"
              children={(field) => (
                <field.SelectField
                  label="Material"
                  required
                  options={materialOptions}
                  placeholder="Select material"
                />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="qty"
                children={(field) => (
                  <field.TextField
                    label="Quantity"
                    required
                    type="number"
                    placeholder="50"
                    description="Not added to stock until Received (GRN)"
                  />
                )}
              />
              <form.AppField
                name="unit_cost"
                children={(field) => (
                  <field.TextField
                    label="Unit Cost"
                    required
                    type="number"
                    placeholder="80"
                    description="Last rate auto: check supplier history"
                  />
                )}
              />
            </div>
            <form.AppField
              name="expected_at"
              children={(field) => (
                <field.TextField label="Expected Date" type="date" placeholder="" />
              )}
            />
            <form.AppField
              name="notes"
              children={(field) => (
                <field.TextareaField label="Notes" placeholder="Delivery instructions" rows={2} />
              )}
            />
            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              Inventory is <b>not</b> updated on creation (draft). Use{" "}
              <b>Send via WhatsApp/Email</b> → <b>Receive (GRN)</b> to add to stock with WAC avg.
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm children={<form.SubmitButton>Create PO</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

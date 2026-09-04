"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { wasteSchema, type WasteValues } from "../schemas/waste";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createWasteLog } from "../api/service";
import { inventoryKeys, rawMaterialsQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";

const reasonOptions = [
  { label: "Spoilage", value: "spoilage" },
  { label: "Expired", value: "expired" },
  { label: "Overproduction", value: "overproduction" },
  { label: "Trimming", value: "trimming" },
  { label: "Spillage", value: "spillage" },
  { label: "Other", value: "other" },
];

export default function WasteForm({ pageTitle }: { pageTitle: string }) {
  const router = useRouter();
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku})`,
    value: m.id,
  }));
  const mutation = useMutation({
    mutationFn: (v: WasteValues) => createWasteLog(v as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Waste logged");
      router.push("/dashboard/inventory/waste");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const form = useAppForm({
    defaultValues: { material_id: "", qty: 1, reason: "spoilage", notes: "" } as WasteValues,
    validators: { onSubmit: wasteSchema },
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
                  <field.TextField label="Quantity" required type="number" placeholder="2" />
                )}
              />
              <form.AppField
                name="reason"
                children={(field) => (
                  <field.SelectField
                    label="Reason"
                    required
                    options={reasonOptions}
                    placeholder="Select reason"
                  />
                )}
              />
            </div>
            <form.AppField
              name="notes"
              children={(field) => (
                <field.TextareaField label="Notes" placeholder="Overripe tomatoes" rows={2} />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm children={<form.SubmitButton>Log Waste</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

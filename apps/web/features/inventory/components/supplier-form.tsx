"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { supplierSchema, type SupplierValues } from "../schemas/supplier";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupplier, updateSupplier } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Supplier } from "../api/types";

export default function SupplierForm({
  initialData,
  pageTitle,
}: {
  initialData: Supplier | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const createMutation = useMutation({
    mutationFn: (v: SupplierValues) => createSupplier(v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Supplier created");
      router.push("/dashboard/inventory/suppliers");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: SupplierValues) => updateSupplier(initialData!.id, v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Supplier updated");
      router.push("/dashboard/inventory/suppliers");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      contact_person: initialData?.contact_person ?? "",
      phone: initialData?.phone ?? "",
      email: initialData?.email ?? "",
      gstin: initialData?.gstin ?? "",
      address: initialData?.address ?? "",
      is_active: initialData?.is_active ?? true,
    } as SupplierValues,
    validators: { onSubmit: supplierSchema },
    onSubmit: async ({ value }) =>
      isEdit ? updateMutation.mutateAsync(value) : createMutation.mutateAsync(value),
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
              name="name"
              children={(field) => (
                <field.TextField label="Supplier Name" required placeholder="Shree Grains" />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="contact_person"
                children={(field) => (
                  <field.TextField label="Contact Person" placeholder="Ramesh Patel" />
                )}
              />
              <form.AppField
                name="phone"
                children={(field) => (
                  <field.TextField label="Phone" required placeholder="9876543001" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField label="Email" type="email" placeholder="supplier@example.com" />
                )}
              />
              <form.AppField
                name="gstin"
                children={(field) => (
                  <field.TextField label="GSTIN" placeholder="24ABCDE1234F1Z5" />
                )}
              />
            </div>
            <form.AppField
              name="address"
              children={(field) => (
                <field.TextareaField
                  label="Address"
                  rows={2}
                  placeholder="APMC Market, Ahmedabad"
                />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField label="Active" description="Available for purchase orders" />
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

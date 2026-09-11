"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { customerSchema, type CustomerValues } from "../schemas/customer";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "../api/service";
import { customerKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Customer } from "../api/types";

export default function CustomerForm({
  initialData,
  pageTitle,
}: {
  initialData: Customer | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation({
    mutationFn: (values: CustomerValues) =>
      createCustomer({
        ...values,
        email: values.email || undefined,
        addresses: values.addresses ?? [],
      } as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
      toast.success("Customer created");
      router.push("/dashboard/customers");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create customer. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: CustomerValues) =>
      updateCustomer(initialData!.id, {
        ...values,
        email: values.email || undefined,
        addresses: values.addresses ?? initialData!.addresses,
      } as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
      toast.success("Customer updated");
      router.push("/dashboard/customers");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update customer. Try again."),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      phone: initialData?.phone ?? "",
      alternate_phone: initialData?.alternate_phone ?? "",
      email: initialData?.email ?? "",
      tags: initialData?.tags ?? [],
      notes: initialData?.notes ?? "",
      is_active: initialData?.is_active ?? true,
      addresses: (initialData?.addresses ?? []).map((a) => ({ ...a })),
    } as any,
    validators: { onSubmit: customerSchema },
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
                  <field.TextField label="Name" required placeholder="Guest name" />
                )}
              />
              <form.AppField
                name="phone"
                children={(field) => (
                  <field.TextField label="Phone" required placeholder="10-digit mobile" description="Unique per outlet" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="alternate_phone"
                children={(field) => (
                  <field.TextField label="Alternate phone" placeholder="Optional" />
                )}
              />
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField label="Email" placeholder="Optional" />
                )}
              />
            </div>
            <form.AppField
              name="tags"
              mode="array"
              children={(field) => (
                <field.TagsField label="Tags" placeholder="VIP, Corporate… (Enter to add)" description="Free-text labels for campaigns and discounts" />
              )}
            />
            <form.AppField
              name="notes"
              children={(field) => (
                <field.TextareaField label="Notes" placeholder="Preferences, allergies…" rows={2} />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField label="Active" description="Available for new orders" />
              )}
            />
          </FieldGroup>

          <form.AppField
            name="addresses"
            mode="array"
            children={(field) => <AddressArrayField field={field as any} />}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>{isEdit ? "Update Customer" : "Create Customer"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AddressArrayField({ field }: { field: any }) {
  const addresses: any[] = field.state.value ?? [];
  const push = (v: any) => field.pushValue(v);
  const remove = (i: number) => field.removeValue(i);
  const updateAt = (i: number, patch: any) => {
    const next = [...addresses];
    next[i] = { ...next[i], ...patch };
    field.setValue(next);
  };
  const setPrimary = (i: number) =>
    field.setValue(addresses.map((a, j) => ({ ...a, is_primary: j === i })));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Addresses</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            push({
              label: "home",
              line1: "",
              locality: "",
              city: "",
              state: "",
              postal_code: "",
              country: "IN",
              is_primary: addresses.length === 0,
            })
          }
        >
          Add address
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        One address is primary — used by default for deliveries and future website orders.
      </p>
      {addresses.map((a, i) => (
        <Card key={i} className="border-dashed">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Address {i + 1}
                {a.is_primary && <span className="ml-2 text-xs text-emerald-600">Primary</span>}
              </p>
              <div className="flex gap-2">
                {!a.is_primary && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPrimary(i)}>
                    Set primary
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                  Remove
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Label</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={a.label}
                  onChange={(e) => updateAt(i, { label: e.target.value })}
                >
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm md:col-span-2">
                <span className="font-medium">Address line 1 *</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  placeholder="Flat, building, street"
                  value={a.line1 ?? ""}
                  onChange={(e) => updateAt(i, { line1: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Locality *</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={a.locality ?? ""}
                  onChange={(e) => updateAt(i, { locality: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">City *</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={a.city ?? ""}
                  onChange={(e) => updateAt(i, { city: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">State *</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={a.state ?? ""}
                  onChange={(e) => updateAt(i, { state: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Postal code *</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={a.postal_code ?? ""}
                  onChange={(e) => updateAt(i, { postal_code: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Latitude</span>
                <input
                  type="number"
                  step="any"
                  className="w-full rounded-md border bg-background px-3 py-2"
                  placeholder="Optional"
                  value={a.latitude ?? ""}
                  onChange={(e) =>
                    updateAt(i, { latitude: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Longitude</span>
                <input
                  type="number"
                  step="any"
                  className="w-full rounded-md border bg-background px-3 py-2"
                  placeholder="Optional"
                  value={a.longitude ?? ""}
                  onChange={(e) =>
                    updateAt(i, { longitude: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

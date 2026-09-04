"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { addressSchema, type AddressValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function AddressForm({ initialData }: { initialData: AddressValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: AddressValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Address updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update address"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: addressSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Premises Address</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.AppField
              name="address_line_1"
              children={(field) => (
                <field.TextField label="Address Line 1" required placeholder="123 MG Road" />
              )}
            />
            <form.AppField
              name="address_line_2"
              children={(field) => (
                <field.TextField label="Address Line 2" placeholder="Near City Center" />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="locality"
                children={(field) => (
                  <field.TextField label="Locality" required placeholder="MG Road" />
                )}
              />
              <form.AppField
                name="city"
                children={(field) => (
                  <field.TextField label="City" required placeholder="Ahmedabad" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="district"
                children={(field) => <field.TextField label="District" placeholder="Ahmedabad" />}
              />
              <form.AppField
                name="state"
                children={(field) => (
                  <field.TextField label="State" required placeholder="Gujarat" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="country"
                children={(field) => (
                  <field.TextField label="Country" required placeholder="India" />
                )}
              />
              <form.AppField
                name="postal_code"
                children={(field) => (
                  <field.TextField label="Postal Code" required placeholder="380015" />
                )}
              />
              <form.AppField
                name="latitude"
                children={(field) => (
                  <field.TextField
                    label="Latitude"
                    type="number"
                    step="0.0001"
                    placeholder="23.0225"
                  />
                )}
              />
            </div>
            <form.AppField
              name="longitude"
              children={(field) => (
                <field.TextField
                  label="Longitude"
                  type="number"
                  step="0.0001"
                  placeholder="72.5714"
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save Address</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

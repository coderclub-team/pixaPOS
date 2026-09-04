"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { businessDetailsSchema, type BusinessDetailsValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function BusinessDetailsForm({
  initialData,
}: {
  initialData: BusinessDetailsValues;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: BusinessDetailsValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Business details updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: businessDetailsSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Business Details</CardTitle>
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
              name="legal_name"
              children={(field) => (
                <field.TextField label="Legal Name" required placeholder="PixaPOS Pvt Ltd" />
              )}
            />
            <form.AppField
              name="pan"
              children={(field) => (
                <field.TextField label="PAN" required placeholder="ABCDE1234F" />
              )}
            />
            <form.AppField
              name="gstin"
              children={(field) => (
                <field.TextField
                  label="GSTIN"
                  placeholder="24ABCDE1234F1Z5"
                  description="15 characters, e.g., 24ABCDE1234F1Z5. Leave blank if not applicable"
                />
              )}
            />
            <form.AppField
              name="fssai_number"
              children={(field) => (
                <field.TextField
                  label="FSSAI Number"
                  placeholder="12345678901234"
                  description="14 digits. Leave blank if not applicable"
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save Business Details</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { gstSchema, type GSTValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function GSTForm({ initialData }: { initialData: GSTValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: GSTValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("GST details updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update GST"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: gstSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">GST Registration</CardTitle>
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
              name="gst_registered"
              children={(field) => (
                <field.SwitchField
                  label="GST Registered"
                  description="Enable if outlet is GST registered"
                />
              )}
            />
            <form.AppField
              name="gstin"
              children={(field) => (
                <field.TextField
                  label="GSTIN"
                  placeholder="24ABCDE1234F1Z5"
                  description="15 characters, e.g., 24ABCDE1234F1Z5"
                />
              )}
            />
            <form.AppField
              name="legal_name"
              children={(field) => (
                <field.TextField label="Legal Name" placeholder="PixaPOS Pvt Ltd" />
              )}
            />
            <form.AppField
              name="pan"
              children={(field) => (
                <field.TextField label="PAN" placeholder="ABCDE1234F" description="10 characters" />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save GST</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { upiSchema, type UPIValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function UPIForm({ initialData }: { initialData: UPIValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: UPIValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("UPI ID updated — bills print collect-QR while a balance is due");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update UPI ID"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: upiSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">UPI Payments</CardTitle>
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
              name="upi_id"
              children={(field) => (
                <field.TextField
                  label="UPI ID (VPA)"
                  placeholder="outlet@okhdfc"
                  description="Printed as the collect-QR on bills with an outstanding balance. Leave empty to disable."
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save UPI</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

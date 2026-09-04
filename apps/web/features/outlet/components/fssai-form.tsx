"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { fssaiSchema, type FSSAIValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function FSSAIForm({ initialData }: { initialData: FSSAIValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: FSSAIValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("FSSAI updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update FSSAI"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: fssaiSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">FSSAI Details</CardTitle>
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
              name="fssai_number"
              children={(field) => (
                <field.TextField
                  label="FSSAI Number"
                  placeholder="12345678901234"
                  description="14 digits"
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save FSSAI</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

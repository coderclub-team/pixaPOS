"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { orderSettingsSchema, type OrderSettingsValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function OrderSettingsForm({ initialData }: { initialData: OrderSettingsValues }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: OrderSettingsValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Order settings updated");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: orderSettingsSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Order Settings</CardTitle>
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
              name="ask_customer_details"
              children={(field) => (
                <field.SwitchField
                  label="Ask customer details"
                  description="When on, counter, takeaway and delivery orders need a name or phone before starting. Off lets staff start empty — the form still shows for optional capture."
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save Order Settings</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

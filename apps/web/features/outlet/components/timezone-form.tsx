"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { timezoneSchema, type TimezoneValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

const currencyOptions = [
  { label: "INR - Indian Rupee", value: "INR" },
  { label: "USD - US Dollar", value: "USD" },
  { label: "EUR - Euro", value: "EUR" },
];

const timezoneOptions = [
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "Asia/Dubai", value: "Asia/Dubai" },
  { label: "America/New_York", value: "America/New_York" },
];

const localeOptions = [
  { label: "en-IN", value: "en-IN" },
  { label: "en-US", value: "en-US" },
];

export default function TimezoneForm({ initialData }: { initialData: TimezoneValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: TimezoneValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Localization updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: timezoneSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Localization</CardTitle>
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
              name="currency"
              children={(field) => (
                <field.SelectField
                  label="Currency"
                  required
                  options={currencyOptions}
                  placeholder="Select currency"
                />
              )}
            />
            <form.AppField
              name="timezone"
              children={(field) => (
                <field.SelectField
                  label="Timezone"
                  required
                  options={timezoneOptions}
                  placeholder="Select timezone"
                />
              )}
            />
            <form.AppField
              name="locale"
              children={(field) => (
                <field.SelectField
                  label="Locale"
                  required
                  options={localeOptions}
                  placeholder="Select locale"
                />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField label="Active" description="Outlet is active" />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save Localization</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

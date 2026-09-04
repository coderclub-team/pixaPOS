"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import {
  basicInformationSchema,
  outletTypeOptions,
  type BasicInformationValues,
} from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function BasicInformationForm({
  initialData,
}: {
  initialData: BasicInformationValues;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: BasicInformationValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Basic information updated");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: basicInformationSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Basic Information</CardTitle>
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField label="Outlet Name" required placeholder="PixaPOS Main Outlet" />
                )}
              />
              <form.AppField
                name="code"
                children={(field) => (
                  <field.TextField label="Outlet Code" required placeholder="PX001" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="alias"
                children={(field) => <field.TextField label="Alias" placeholder="Main" />}
              />
              <form.AppField
                name="type"
                children={(field) => (
                  <field.SelectField
                    label="Outlet Type"
                    required
                    options={[...outletTypeOptions]}
                    placeholder="Select type"
                  />
                )}
              />
            </div>
            <form.AppField
              name="logo_url"
              children={(field) => (
                <field.FileUploadField
                  label="Logo"
                  description="Upload outlet logo (JPG, PNG, WebP, max 5MB)"
                  maxSize={5 * 1024 * 1024}
                  maxFiles={1}
                />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField
                  label="Active Outlet"
                  description="Enable or disable this outlet"
                />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm
              children={<form.SubmitButton>Save Basic Information</form.SubmitButton>}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

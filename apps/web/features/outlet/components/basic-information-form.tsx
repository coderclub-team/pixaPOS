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
    // Logo uploads on Save, not on pick: a staged File[] is POSTed to
    // /api/outlet-logo first and the returned URL is what gets persisted.
    mutationFn: async (values: BasicInformationValues) => {
      const logo = (values as { logo_url?: string | File[] }).logo_url;
      if (Array.isArray(logo) && logo.length > 0 && logo[0] instanceof File) {
        const form = new FormData();
        form.append("file", logo[0]);
        form.append("outlet_id", "out_001");
        const res = await fetch("/api/outlet-logo", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as {
          url?: string;
          error?: string;
        } | null;
        if (!res.ok || !data?.url) throw new Error(data?.error ?? "Logo upload failed");
        return updateOutlet({ ...values, logo_url: data.url });
      }
      return updateOutlet(values);
    },
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
      const updated = await mutation.mutateAsync(value);
      // Swap the staged File[] for the persisted URL so the preview survives
      // without a reload.
      if (typeof updated.logo_url === "string") {
        form.setFieldValue("logo_url", updated.logo_url);
      }
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
                  description="Pick a logo (JPG, PNG, WebP, max 5MB) — uploads when you save"
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

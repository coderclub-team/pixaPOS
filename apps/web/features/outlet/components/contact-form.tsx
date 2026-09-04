"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { contactSchema, type ContactValues } from "../schemas/outlet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import { toast } from "sonner";

export default function ContactForm({ initialData }: { initialData: ContactValues }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: ContactValues) => updateOutlet(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Contact updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update contact"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: contactSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Contact Information</CardTitle>
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
                name="phone"
                children={(field) => (
                  <field.TextField label="Phone" required placeholder="9876543210" type="tel" />
                )}
              />
              <form.AppField
                name="alternate_phone"
                children={(field) => (
                  <field.TextField label="Alternate Phone" placeholder="Optional" type="tel" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField
                    label="Email"
                    required
                    placeholder="outlet@pixapos.com"
                    type="email"
                  />
                )}
              />
              <form.AppField
                name="whatsapp"
                children={(field) => (
                  <field.TextField label="WhatsApp" placeholder="9876543210" type="tel" />
                )}
              />
            </div>
            <form.AppField
              name="website"
              children={(field) => (
                <field.TextField label="Website" placeholder="https://pixapos.com" type="url" />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save Contact</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

const enquirySchema = z.object({
  businessName: z.string().min(1, "Business name required"),
  contactName: z.string().min(1, "Contact name required"),
  email: z.email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone"),
  city: z.string(),
  outletsPlanned: z.string(),
  source: z.string(),
  notes: z.string(),
});

const SOURCES = ["website", "youtube", "instagram", "referral", "field-sales", "other"];

export function NewEnquiryForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const form = useAppForm({
    defaultValues: {
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      city: "",
      outletsPlanned: "1",
      source: "website",
      notes: "",
    },
    validators: { onSubmit: enquirySchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/crm/enquiries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...value, outletsPlanned: Number(value.outletsPlanned) || 1 }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Save failed");
        toast.success("Enquiry logged");
        router.push("/admin/crm");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.AppField
                name="businessName"
                children={(field) => <field.TextField label="Business" required />}
              />
              <form.AppField
                name="contactName"
                children={(field) => <field.TextField label="Contact" required />}
              />
              <form.AppField
                name="email"
                children={(field) => <field.TextField label="Email" required type="email" />}
              />
              <form.AppField
                name="phone"
                children={(field) => <field.TextField label="Phone" required />}
              />
              <form.AppField name="city" children={(field) => <field.TextField label="City" />} />
              <form.AppField
                name="outletsPlanned"
                children={(field) => <field.TextField label="Outlets planned" />}
              />
              <form.AppField
                name="source"
                children={(field) => (
                  <field.SelectField
                    label="Source"
                    options={SOURCES.map((s) => ({ value: s, label: s }))}
                  />
                )}
              />
            </div>
            <form.AppField
              name="notes"
              children={(field) => <field.TextareaField label="Notes" rows={3} />}
            />
          </FieldGroup>
          <div className="mt-6 flex gap-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting}>
                  <Icons.add className="size-4" aria-hidden />
                  Log enquiry
                </Button>
              )}
            </form.Subscribe>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/crm")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

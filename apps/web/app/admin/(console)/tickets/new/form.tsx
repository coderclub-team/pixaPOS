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

const PRIORITIES = ["low", "normal", "high", "urgent"];
const CHANNELS = ["app", "phone", "email", "whatsapp", "field"];

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject required"),
  description: z.string().min(1, "Describe the complaint"),
  organizationId: z.string(),
  priority: z.string(),
  channel: z.string(),
  reporterEmail: z.string(),
});

export function NewTicketForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const form = useAppForm({
    defaultValues: {
      subject: "",
      description: "",
      organizationId: "",
      priority: "normal",
      channel: "app",
      reporterEmail: "",
    },
    validators: { onSubmit: ticketSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...value,
            organizationId: value.organizationId.trim() || null,
            reporterEmail: value.reporterEmail.trim() || null,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Save failed");
        toast.success("Ticket opened");
        router.push("/admin/tickets");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl">
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
                  name="subject"
                  children={(field) => <field.TextField label="Subject" required />}
                />
                <form.AppField
                  name="reporterEmail"
                  children={(field) => <field.TextField label="Reporter email" type="email" />}
                />
                <form.AppField
                  name="organizationId"
                  children={(field) => <field.TextField label="Organisation ID (optional)" />}
                />
                <form.AppField
                  name="priority"
                  children={(field) => (
                    <field.SelectField
                      label="Priority"
                      options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                    />
                  )}
                />
                <form.AppField
                  name="channel"
                  children={(field) => (
                    <field.SelectField
                      label="Channel"
                      options={CHANNELS.map((c) => ({ value: c, label: c }))}
                    />
                  )}
                />
              </div>
              <form.AppField
                name="description"
                children={(field) => <field.TextareaField label="Description" required rows={3} />}
              />
            </FieldGroup>
            <div className="mt-6 flex gap-2">
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={busy || submitting}>
                    <Icons.add className="size-4" aria-hidden />
                    Open ticket
                  </Button>
                )}
              </form.Subscribe>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/tickets")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

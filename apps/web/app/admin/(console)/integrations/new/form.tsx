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
import { KIND_OPTIONS } from "../provider-kinds";

const providerSchema = z.object({
  channel: z.string().min(1),
  provider: z.string().min(1),
  displayName: z.string().min(1, "Display name required"),
});

export function NewProviderForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const form = useAppForm({
    defaultValues: { channel: "whatsapp", provider: "meta-cloud", displayName: "" },
    validators: { onSubmit: providerSchema },
    onSubmit: async ({ value }) => {
      const kind = KIND_OPTIONS.find((k) => k.channel === value.channel);
      if (!kind?.providers.some((p) => p.id === value.provider)) {
        toast.error("Pick a provider for this channel first");
        form.setFieldValue("provider", kind?.providers[0]?.id ?? value.provider);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/admin/messaging/providers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...value, config: {} }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Save failed");
        toast.success("Provider added — now set its credentials");
        router.push("/admin/integrations");
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <form.AppField
                name="channel"
                children={(field) => (
                  <field.SelectField
                    label="Channel"
                    options={KIND_OPTIONS.map((k) => ({ value: k.channel, label: k.channel }))}
                  />
                )}
              />
              <form.AppField
                name="provider"
                children={(field) => (
                  <field.SelectField
                    label="Provider"
                    options={(
                      KIND_OPTIONS.find((k) => k.channel === field.state.value)?.providers ?? []
                    ).map((p) => ({ value: p.id, label: p.label }))}
                  />
                )}
              />
              <form.AppField
                name="displayName"
                children={(field) => <field.TextField label="Display name" required />}
              />
            </div>
          </FieldGroup>
          <p className="mt-2 text-xs text-muted-foreground">
            Credentials are set after creation (never echoed back — masked as ••••••).
          </p>
          <div className="mt-6 flex gap-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting}>
                  <Icons.add className="size-4" aria-hidden />
                  Add provider
                </Button>
              )}
            </form.Subscribe>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/integrations")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

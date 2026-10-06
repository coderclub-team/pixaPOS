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

const inviteSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(12, "Password needs 12+ characters"),
  roleId: z.string(),
});

export function InviteOwnerForm({ roles }: { roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const roleOptions = [
    { value: "none", label: "Staff (no role)" },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  const form = useAppForm({
    defaultValues: { email: "", password: "", roleId: "none" },
    validators: { onSubmit: inviteSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/owners", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: value.email,
            password: value.password,
            roleId: value.roleId === "none" ? null : value.roleId,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Invite failed");
        toast.success(`Invited ${value.email}`);
        router.push("/admin/users");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Invite failed");
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
            <form.AppField
              name="email"
              children={(field) => (
                <field.TextField label="Email" required type="email" autoComplete="off" />
              )}
            />
            <form.AppField
              name="password"
              children={(field) => (
                <field.TextField
                  label="Password"
                  required
                  type="password"
                  autoComplete="new-password"
                  description="12+ characters"
                />
              )}
            />
            <form.AppField
              name="roleId"
              children={(field) => <field.SelectField label="Role" options={roleOptions} />}
            />
          </FieldGroup>
          <div className="mt-6 flex gap-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting}>
                  <Icons.add className="size-4" aria-hidden />
                  Invite staff
                </Button>
              )}
            </form.Subscribe>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

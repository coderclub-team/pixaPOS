"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

type Owner = {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  isActive: boolean;
};

const inviteSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(12, "Password needs 12+ characters"),
  roleId: z.string(),
});

async function api(url: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function OwnerActions({
  owners,
  roles,
}: {
  owners: Owner[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Owner | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<Owner | null>(null);
  const [newPassword, setNewPassword] = useState("");

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
        await api("/api/admin/owners", "POST", {
          email: value.email,
          password: value.password,
          roleId: value.roleId === "none" ? null : value.roleId,
        });
        toast.success(`Invited ${value.email}`);
        form.reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Invite failed");
      } finally {
        setBusy(false);
      }
    },
  });

  const saveRow = async (id: string, patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/owners/${id}`, "PATCH", patch);
      toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Invite staff</CardTitle>
        </CardHeader>
        <CardContent>
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
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting} className="mt-4">
                  <Icons.add className="size-4" aria-hidden />
                  Invite staff
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {owners.map((o) => (
          <li key={o.id}>
            <Card className={!o.isActive ? "opacity-60" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-2 pt-4">
                <p className="font-medium">{o.email}</p>
                <Badge variant={o.role === "super_owner" ? "default" : "secondary"}>
                  {o.role === "super_owner" ? "super owner" : "staff"}
                </Badge>
                {!o.isActive && <Badge variant="destructive">deactivated</Badge>}
                {o.role !== "super_owner" && (
                  <>
                    <Select
                      value={o.roleId ?? "none"}
                      disabled={busy}
                      onValueChange={(v) =>
                        void saveRow(
                          o.id,
                          { roleId: v === "none" ? null : v },
                          `Role updated for ${o.email}`,
                        )
                      }
                    >
                      <SelectTrigger className="ml-auto w-44" aria-label={`Role for ${o.email}`}>
                        <SelectValue placeholder="Staff (no role)" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r.value || "none"} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        o.isActive
                          ? setDeactivateTarget(o)
                          : void saveRow(o.id, { isActive: true }, `${o.email} activated`)
                      }
                    >
                      {o.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setResetTarget(o)}
                    >
                      Reset password
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivateTarget?.email}?</DialogTitle>
            <DialogDescription>
              They lose console access immediately and all their sessions are revoked. Enter your
              password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="deactivate-confirm">Your password</Label>
            <Input
              id="deactivate-confirm"
              type="password"
              autoComplete="current-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !confirmPassword || !deactivateTarget}
              onClick={() => {
                if (!deactivateTarget) return;
                void saveRow(
                  deactivateTarget.id,
                  { isActive: false, confirmPassword },
                  `${deactivateTarget.email} deactivated`,
                ).then(() => {
                  setDeactivateTarget(null);
                  setConfirmPassword("");
                });
              }}
            >
              Confirm deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetTarget?.email}?</DialogTitle>
            <DialogDescription>
              They are logged out everywhere immediately. Enter your password to confirm, plus their
              new one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-confirm">Your password</Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="current-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-new">Their new password (12+ chars)</Label>
              <Input
                id="reset-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !confirmPassword || newPassword.length < 12 || !resetTarget}
              onClick={() => {
                if (!resetTarget) return;
                void saveRow(
                  resetTarget.id,
                  { password: newPassword, confirmPassword },
                  `Password reset for ${resetTarget.email}`,
                ).then(() => {
                  setResetTarget(null);
                  setConfirmPassword("");
                  setNewPassword("");
                });
              }}
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

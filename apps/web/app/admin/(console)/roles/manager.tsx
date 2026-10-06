"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Checkbox } from "@pixa/ui/base-ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

type Role = { id: string; name: string; permissions: string[] };

const roleSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

async function api(url: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function RolesManager({
  initialRoles,
  vocabulary,
}: {
  initialRoles: Role[];
  vocabulary: string[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const toggle = (p: string) =>
    setChecked((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  const form = useAppForm({
    defaultValues: { name: "" },
    validators: { onSubmit: roleSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        if (editing) {
          await api(`/api/admin/roles/${editing.id}`, "PATCH", {
            name: value.name,
            permissions: checked,
          });
          toast.success(`Role ${value.name} saved`);
        } else {
          await api("/api/admin/roles", "POST", { name: value.name, permissions: checked });
          toast.success(`Role ${value.name} created`);
        }
        form.reset();
        setChecked([]);
        setEditing(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {initialRoles.map((r) => (
          <li key={r.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 pt-4">
                <p className="font-medium">{r.name}</p>
                <Badge variant="secondary">{r.permissions.length} permissions</Badge>
                <span className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(r);
                      setChecked(r.permissions);
                      form.setFieldValue("name", r.name);
                    }}
                  >
                    <Icons.edit className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)}>
                    <Icons.trash className="size-3.5" aria-hidden />
                    Delete
                  </Button>
                </span>
              </CardContent>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{r.permissions.join(", ") || "—"}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit role" : "New role"}</CardTitle>
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
                name="name"
                children={(field) => <field.TextField label="Name" required />}
              />
            </FieldGroup>
            <div className="mt-4 grid gap-1 sm:grid-cols-2" role="group" aria-label="Permissions">
              {vocabulary.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked.includes(p)} onCheckedChange={() => toggle(p)} />
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p}</code>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={busy || submitting}>
                    {editing ? "Save role" : "Create role"}
                  </Button>
                )}
              </form.Subscribe>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    form.reset();
                    setChecked([]);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Only possible when no owner holds it — the server enforces this. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return;
                setBusy(true);
                api(`/api/admin/roles/${deleteTarget.id}`, "DELETE")
                  .then(() => {
                    toast.success(`Role ${deleteTarget.name} deleted`);
                    setDeleteTarget(null);
                    router.refresh();
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"))
                  .finally(() => setBusy(false));
              }}
            >
              <Icons.trash className="size-3.5" aria-hidden />
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

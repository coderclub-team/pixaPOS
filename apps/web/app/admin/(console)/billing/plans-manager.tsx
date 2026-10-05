"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export type CatalogPlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthlyPaise: number | null;
  annualDiscountPct: number;
  features: string[];
  outletLimit: number | null;
  sortOrder: number;
  isActive: boolean;
};

function inr(paise: number | null): string {
  if (paise === null) return "Custom";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const planSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  tagline: z.string(),
  monthlyInr: z.string(),
  annualDiscountPct: z.string(),
  features: z.string(),
  outletLimit: z.string(),
  sortOrder: z.string(),
});

type PlanValues = z.infer<typeof planSchema>;

const emptyValues: PlanValues = {
  id: "",
  name: "",
  tagline: "",
  monthlyInr: "",
  annualDiscountPct: "20",
  features: "",
  outletLimit: "",
  sortOrder: "0",
};

async function api(url: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

function toBody(value: PlanValues, isEdit: boolean) {
  if (!isEdit && !/^[a-z0-9-]{2,40}$/.test(value.id.trim().toLowerCase())) {
    throw new Error("ID must be a 2–40 char lowercase slug");
  }
  return {
    ...(isEdit ? {} : { id: value.id.trim().toLowerCase() }),
    name: value.name.trim(),
    tagline: value.tagline.trim() || null,
    monthlyPaise:
      value.monthlyInr.trim() === "" ? null : Math.round(Number(value.monthlyInr) * 100),
    annualDiscountPct: Number(value.annualDiscountPct) || 0,
    features: value.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    outletLimit: value.outletLimit.trim() === "" ? null : Number(value.outletLimit),
    sortOrder: Number(value.sortOrder) || 0,
  };
}

export function PlansManager({ initialPlans }: { initialPlans: CatalogPlan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CatalogPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<CatalogPlan | null>(null);

  const form = useAppForm({
    defaultValues: emptyValues,
    validators: { onSubmit: planSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        if (editing) {
          await api(`/api/admin/plans/${editing.id}`, "PATCH", toBody(value, true));
          toast.success(`Plan ${value.name} saved`);
        } else {
          await api("/api/admin/plans", "POST", toBody(value, false));
          toast.success(`Plan ${value.name} created`);
        }
        form.reset();
        setEditing(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  function startEdit(p: CatalogPlan) {
    setEditing(p);
    form.reset({
      id: p.id,
      name: p.name,
      tagline: p.tagline ?? "",
      monthlyInr: p.monthlyPaise === null ? "" : String(p.monthlyPaise / 100),
      annualDiscountPct: String(p.annualDiscountPct),
      features: p.features.join("\n"),
      outletLimit: p.outletLimit === null ? "" : String(p.outletLimit),
      sortOrder: String(p.sortOrder),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {initialPlans.map((p) => (
          <Card key={p.id} className={cn(!p.isActive && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {p.name}
                {!p.isActive && <Badge variant="secondary">inactive</Badge>}
              </CardTitle>
              <p className="text-2xl font-semibold">{inr(p.monthlyPaise)}</p>
              {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Icons.check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {p.outletLimit ? `≤ ${p.outletLimit} outlets` : "Unlimited outlets"} ·{" "}
                {p.annualDiscountPct}% annual off
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                  <Icons.edit className="size-3.5" aria-hidden />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => (p.isActive ? setDeactivateTarget(p) : void toggleActive(p, true))}
                >
                  {p.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? `Edit plan ${editing.id}` : "New plan"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              {!editing && (
                <form.AppField
                  name="id"
                  children={(field) => (
                    <field.TextField
                      label="ID (slug)"
                      required
                      placeholder="growth-plus"
                      description="Lowercase letters, digits, dashes — used by org profiles."
                    />
                  )}
                />
              )}
              <form.AppField
                name="name"
                children={(field) => <field.TextField label="Name" required />}
              />
              <form.AppField
                name="tagline"
                children={(field) => <field.TextField label="Tagline" />}
              />
              <form.AppField
                name="monthlyInr"
                children={(field) => (
                  <field.TextField
                    label="₹/month"
                    placeholder="1999"
                    description="Blank = custom pricing"
                  />
                )}
              />
              <form.AppField
                name="annualDiscountPct"
                children={(field) => <field.TextField label="Annual discount %" />}
              />
              <form.AppField
                name="outletLimit"
                children={(field) => (
                  <field.TextField label="Outlet limit" description="Blank = unlimited" />
                )}
              />
              <form.AppField
                name="features"
                children={(field) => (
                  <field.TextareaField label="Features" description="One per line" rows={4} />
                )}
              />
            </FieldGroup>
            <div className="mt-4 flex gap-2">
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={busy || submitting}>
                    {editing ? "Save plan" : "Create plan"}
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
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate plan “{deactivateTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Blocked while any organisation sits on it. New signups stop seeing it immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !deactivateTarget}
              onClick={() => {
                if (!deactivateTarget) return;
                setBusy(true);
                api(`/api/admin/plans/${deactivateTarget.id}`, "PATCH", { isActive: false })
                  .then(() => {
                    toast.success(`Plan ${deactivateTarget.name} deactivated`);
                    setDeactivateTarget(null);
                    router.refresh();
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Confirm deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function toggleActive(p: CatalogPlan, active: boolean) {
    setBusy(true);
    try {
      await api(`/api/admin/plans/${p.id}`, "PATCH", { isActive: active });
      toast.success(`Plan ${p.name} ${active ? "activated" : "deactivated"}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
}

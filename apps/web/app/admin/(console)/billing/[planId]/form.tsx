"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";
import { GB, MB, type LimitMap, type ResourceLimit } from "@pixa/db/plans";

export type EditablePlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthlyPaise: number | null;
  annualDiscountPct: number;
  sortOrder: number;
  features: string[];
  limits: LimitMap;
};

const LIMIT_FIELDS: {
  key: ResourceLimit;
  label: string;
  unit: "count" | "gb" | "mb" | "cuh";
}[] = [
  { key: "outlets", label: "Outlets", unit: "count" },
  { key: "users", label: "Users", unit: "count" },
  { key: "devices", label: "Devices", unit: "count" },
  { key: "orders", label: "Orders / month", unit: "count" },
  { key: "products", label: "Products", unit: "count" },
  { key: "customers", label: "Customers", unit: "count" },
  { key: "databaseStorage", label: "Database storage", unit: "gb" },
  { key: "objectStorage", label: "Object storage", unit: "gb" },
  { key: "compute", label: "Compute", unit: "cuh" },
  { key: "functions", label: "Function calls / month", unit: "count" },
  { key: "transfer", label: "Data transfer", unit: "gb" },
  { key: "writtenData", label: "Written data", unit: "mb" },
];

const UNIT_SUFFIX: Record<string, string> = { gb: "GB", mb: "MB", cuh: "CU-h" };

function trimNum(n: number): string {
  return String(Number(n.toFixed(3)));
}

function limitsToForm(limits: LimitMap): Record<ResourceLimit, string> {
  const out = {} as Record<ResourceLimit, string>;
  for (const f of LIMIT_FIELDS) {
    const v = limits[f.key];
    if (v === null) out[f.key] = "";
    else if (f.unit === "gb") out[f.key] = trimNum(v / GB);
    else if (f.unit === "mb") out[f.key] = trimNum(v / MB);
    else out[f.key] = String(v);
  }
  return out;
}

function limitsFromForm(state: Record<ResourceLimit, string>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const f of LIMIT_FIELDS) {
    const raw = (state[f.key] ?? "").trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      out[f.key] = null;
    } else if (f.unit === "gb") {
      out[f.key] = Math.round(n * GB);
    } else if (f.unit === "mb") {
      out[f.key] = Math.round(n * MB);
    } else {
      out[f.key] = Math.max(0, Math.floor(n));
    }
  }
  return out;
}

const planSchema = z.object({
  name: z.string().min(1, "Name is required"),
  tagline: z.string(),
  monthlyInr: z.string(),
  annualDiscountPct: z.string(),
  sortOrder: z.string(),
});

export function PlanForm({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [features, setFeatures] = useState<string[]>(
    plan.features.length > 0 ? plan.features : [""],
  );
  const [limits, setLimits] = useState<Record<ResourceLimit, string>>(() =>
    limitsToForm(plan.limits),
  );

  const form = useAppForm({
    defaultValues: {
      name: plan.name,
      tagline: plan.tagline ?? "",
      monthlyInr: plan.monthlyPaise === null ? "" : String(plan.monthlyPaise / 100),
      annualDiscountPct: String(plan.annualDiscountPct),
      sortOrder: String(plan.sortOrder),
    },
    validators: { onSubmit: planSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: value.name.trim(),
            tagline: value.tagline.trim() || null,
            monthlyPaise:
              value.monthlyInr.trim() === "" ? null : Math.round(Number(value.monthlyInr) * 100),
            annualDiscountPct: Number(value.annualDiscountPct) || 0,
            sortOrder: Number(value.sortOrder) || 0,
            features: features.map((f) => f.trim()).filter(Boolean),
            limits: limitsFromForm(limits),
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Save failed");
        toast.success(`Plan ${value.name} saved`);
        router.push("/admin/billing");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    label="₹ / month"
                    placeholder="1499"
                    description="Blank = custom pricing"
                  />
                )}
              />
              <form.AppField
                name="annualDiscountPct"
                children={(field) => (
                  <field.TextField
                    label="Annual discount %"
                    description="Shown on the landing page"
                  />
                )}
              />
              <form.AppField
                name="sortOrder"
                children={(field) => (
                  <field.TextField label="Sort order" description="Lower shows first" />
                )}
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMIT_FIELDS.map((f) => (
              <div key={f.key} className="grid gap-2">
                <Label htmlFor={`limit-${f.key}`}>
                  {f.label}
                  {UNIT_SUFFIX[f.unit] ? ` (${UNIT_SUFFIX[f.unit]})` : ""}
                </Label>
                <Input
                  id={`limit-${f.key}`}
                  inputMode="decimal"
                  value={limits[f.key]}
                  placeholder="Blank = custom"
                  onChange={(e) => setLimits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Input
                value={f}
                aria-label={`Feature ${i + 1}`}
                placeholder="e.g. Inventory, batches & wastage"
                onChange={(e) =>
                  setFeatures((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove feature ${i + 1}`}
                onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
              >
                <Icons.trash className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFeatures((prev) => [...prev, ""])}
          >
            <Icons.add className="size-3.5" aria-hidden />
            Add feature
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={busy || submitting}>
              {busy || submitting ? "Saving…" : "Save plan"}
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/billing")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

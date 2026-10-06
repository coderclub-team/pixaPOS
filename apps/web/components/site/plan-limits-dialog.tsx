"use client";

import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import type { LimitMap, ResourceLimit } from "@pixa/db/plans";
import { RESOURCE_META, formatBytes, formatNumber } from "@/lib/usage-types";

/** Customer-facing usage-limit rows — no infrastructure cost or Neon rates. */
const LIMIT_ROWS: { key: ResourceLimit; label: string }[] = [
  { key: "outlets", label: "Outlets" },
  { key: "users", label: "Users" },
  { key: "devices", label: "Devices" },
  { key: "orders", label: "Orders / month" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
  { key: "databaseStorage", label: "Database storage" },
  { key: "objectStorage", label: "File storage" },
];

function fmt(key: ResourceLimit, value: number | null): string {
  if (value === null) return "Custom";
  return RESOURCE_META[key].unit === "bytes" ? formatBytes(value) : formatNumber(value);
}

export function PlanLimitsDialog({
  open,
  onOpenChange,
  name,
  limits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  limits: LimitMap | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name} — what&apos;s included</DialogTitle>
          <DialogDescription>Usage limits included in the {name} plan.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-lg border">
          {LIMIT_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">
                {fmt(row.key, limits?.[row.key] ?? null)}
              </dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

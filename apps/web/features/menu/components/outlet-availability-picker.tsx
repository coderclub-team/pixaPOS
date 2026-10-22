"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { outletsQueryOptions } from "@/features/outlet/api/queries";

type MasterType =
  | "categories"
  | "items"
  | "modifier-groups"
  | "recipes"
  | "materials"
  | "suppliers";

async function fetchOutlets(entityType: MasterType, entityId: string): Promise<string[]> {
  const res = await fetch(`/api/masters/${entityType}/${encodeURIComponent(entityId)}/outlets`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { outlet_ids?: string[] };
  return data.outlet_ids ?? [];
}

/**
 * Per-outlet availability for a shared master row. Masters live org-wide;
 * a mapping row means "served/stocked at this outlet". Shown on edit forms
 * only — new rows map to every outlet on first server save.
 */
export function OutletAvailabilityPicker({
  entityType,
  entityId,
  entityName,
}: {
  entityType: MasterType;
  entityId: string;
  entityName: string;
}) {
  const queryClient = useQueryClient();
  const { data: outlets } = useQuery(outletsQueryOptions);
  const key = ["masters", entityType, entityId, "outlets"];
  const { data: mapped, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchOutlets(entityType, entityId),
  });
  const [checked, setChecked] = React.useState<string[] | null>(null);
  const selected = checked ?? mapped ?? [];
  const missingOnServer = !isPending && mapped !== undefined && outlets !== undefined;

  const save = useMutation({
    mutationFn: async (outletIds: string[]) => {
      const res = await fetch(
        `/api/masters/${entityType}/${encodeURIComponent(entityId)}/outlets`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ outlet_ids: outletIds }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to save outlet availability");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      setChecked(null);
      toast.success(`Availability saved for ${entityName || "item"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !outlets) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available at outlets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading outlets…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available at outlets</CardTitle>
        <CardDescription>
          Shared master, per-outlet availability. Untick to hide it from an outlet&apos;s menu and
          reports without deleting it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {missingOnServer && mapped.length === 0 && (
          <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            No server copy of this row yet — it exists only in this browser. Availability applies
            once the row exists on the server.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {(outlets ?? []).map((o) => {
            const on = selected.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs",
                  on && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setChecked((prev) => {
                      const cur = prev ?? mapped ?? [];
                      return cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id];
                    })
                  }
                  className="sr-only"
                />
                <span>{o.name}</span>
              </label>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={save.isPending || checked === null}
          onClick={() => checked && save.mutate(checked)}
        >
          <Icons.check className="mr-1 h-4 w-4" />
          {save.isPending ? "Saving…" : "Save availability"}
        </Button>
      </CardContent>
    </Card>
  );
}

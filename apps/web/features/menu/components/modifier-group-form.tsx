"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Switch } from "@pixa/ui/base-ui/switch";
import { Icons } from "@pixa/ui/icons";
import { menuKeys } from "../api/queries";
import { createModifierGroup, updateModifierGroup } from "../api/service";
import type { ModifierGroup } from "../api/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/**
 * Add-on group editor: name, min/max selection, active flag. Max 1 forces
 * single-choice (Odoo/Roller pattern); min 0 = optional, min ≥ 1 = required
 * at fire time with a named-group error.
 */
export default function ModifierGroupForm({ initialData }: { initialData?: ModifierGroup }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [min, setMin] = useState(initialData?.min_selection ?? 0);
  const [max, setMax] = useState(initialData?.max_selection ?? 3);
  const [active, setActive] = useState(initialData?.is_active ?? true);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateModifierGroup(initialData!.id, {
            name,
            min_selection: min,
            max_selection: max,
            selection_type: max === 1 ? "single" : "multiple",
            is_active: active,
          })
        : createModifierGroup({
            name,
            min_selection: min,
            max_selection: max,
            selection_type: max === 1 ? "single" : "multiple",
          }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all });
      toast.success(isEdit ? "Add-on group updated" : "Add-on group created");
      router.push(`/dashboard/menu/modifiers/${group.id}/edit`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stepper = (
    label: string,
    value: number,
    set: (n: number) => void,
    minV: number,
    hint: string,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={value <= minV}
          onClick={() => set(value - 1)}
          aria-label={`Decrease ${label}`}
        >
          <Icons.minus className="size-4" />
        </Button>
        <span className="w-8 text-center text-lg font-bold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => set(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <Icons.add className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">
          {isEdit ? "Edit add-on group" : "New add-on group"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="mg-name">Group name</Label>
          <Input
            id="mg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Extra toppings"
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {stepper(
            "Min selection",
            min,
            (n) => setMin(Math.max(0, n)),
            0,
            "0 = optional, 1+ = required at fire time",
          )}
          {stepper("Max selection", max, (n) => setMax(Math.max(1, n)), 1, "1 = single choice")}
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {min === 0 && max === 1 && "Optional single choice — e.g. Add a dip?"}
          {min >= 1 && max === 1 && "Required single choice — e.g. Choose your size."}
          {min >= 1 && max > 1 && `Required multi-select — pick ${min} to ${max}.`}
          {min === 0 && max > 1 && `Optional multi-select — up to ${max}.`}
        </p>
        {isEdit && (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive groups hide everywhere.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Group active" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || name.trim().length < 2 || max < min}
            onClick={() => mutation.mutate()}
            className="min-h-11"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save group" : "Create group"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

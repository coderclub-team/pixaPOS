"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import {
  tableSchema,
  tableShapeOptions,
  tableStatusOptions,
  type TableValues,
} from "../schemas/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createTable, suggestDuplicateIdentifiers, updateTable } from "../api/service";
import { tableKeys, tablesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { RestaurantTable } from "../api/types";
import { floorsQueryOptions } from "@/features/floor/api/queries";

export default function TableForm({
  initialData,
  duplicateFrom,
  pageTitle,
}: {
  initialData: RestaurantTable | null;
  duplicateFrom?: RestaurantTable | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const isDuplicate = !isEdit && !!duplicateFrom;

  const { data: floors } = useQuery(floorsQueryOptions());
  const floorOptions = (floors ?? [])
    .filter((f) => f.is_active)
    .map((f) => ({ label: `${f.name} (${f.code})`, value: f.id }));

  // Prefill identifiers for the duplicate flow: next free number/code in the outlet.
  const { data: allTables } = useQuery({
    ...tablesQueryOptions({}),
    enabled: isDuplicate,
  });
  const suggested = isDuplicate && duplicateFrom && allTables
    ? suggestDuplicateIdentifiers(duplicateFrom, allTables)
    : null;

  const createMutation = useMutation({
    mutationFn: (values: TableValues) => createTable(values as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success(isDuplicate ? `Duplicated to ${form.state.values.number}` : "Table created");
      router.push("/dashboard/settings/outlet/tables");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create table. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: TableValues) => updateTable(initialData!.id, values as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success("Table updated");
      router.push("/dashboard/settings/outlet/tables");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update table. Try again."),
  });

  const seed = initialData ?? duplicateFrom ?? null;
  const form = useAppForm({
    defaultValues: {
      floor_id: seed?.floor_id ?? "",
      number: suggested?.number ?? seed?.number ?? "",
      code: suggested?.code ?? seed?.code ?? "",
      capacity: seed?.capacity ?? 2,
      shape: seed?.shape ?? "square",
      status: "available",
      sort_order: initialData?.sort_order ?? 0,
      is_active: initialData?.is_active ?? true,
      allows_sharing: seed?.allows_sharing ?? false,
      type: seed?.type ?? "standard",
    } as any,
    validators: { onSubmit: tableSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  // The duplicate suggestion resolves after first render — push it into the
  // form once (guarded so user edits afterwards are never clobbered).
  const suggestionApplied = useRef(false);
  useEffect(() => {
    if (!isDuplicate || suggestionApplied.current || !suggested || !duplicateFrom) return;
    suggestionApplied.current = true;
    form.reset({
      floor_id: duplicateFrom.floor_id,
      number: suggested.number,
      code: suggested.code,
      capacity: duplicateFrom.capacity,
      shape: duplicateFrom.shape,
      status: "available",
      sort_order: 0,
      is_active: true,
      allows_sharing: duplicateFrom.allows_sharing,
      type: duplicateFrom.type,
    } as any);
  }, [isDuplicate, suggested, duplicateFrom, form]);

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {isDuplicate && duplicateFrom && (
          <p className="mb-6 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Duplicating <span className="font-medium text-foreground">{duplicateFrom.number}</span>
            <span className="font-mono text-xs"> ({duplicateFrom.code})</span> — layout, capacity
            and settings are copied. Review the number and code, then save.
          </p>
        )}
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.AppField
              name="floor_id"
              children={(field) => (
                <field.SelectField
                  label="Floor"
                  required
                  options={floorOptions}
                  placeholder="Select floor"
                  description="Tables belong to a floor (Ground, Rooftop...)"
                />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="number"
                children={(field) => (
                  <field.TextField label="Table No." required placeholder="T1" />
                )}
              />
              <form.AppField
                name="code"
                children={(field) => (
                  <field.TextField
                    label="Code"
                    required
                    placeholder="T-GF-01"
                    description="Unique, e.g., T-GF-01"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="type"
                children={(field) => (
                  <field.SelectField
                    label="Table Type"
                    required
                    options={[
                      { label: "Standard", value: "standard" },
                      { label: "Bar Counter", value: "bar_counter" },
                      { label: "Communal", value: "communal" },
                      { label: "Outdoor", value: "outdoor" },
                      { label: "Private", value: "private" },
                    ]}
                    placeholder="Select type"
                  />
                )}
              />
              <form.AppField
                name="allows_sharing"
                children={(field) => (
                  <field.SwitchField
                    label="Allow Sharing"
                    description="Multiple guest groups on one table"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="capacity"
                children={(field) => (
                  <field.TextField
                    label="Capacity"
                    required
                    type="number"
                    placeholder="4"
                    description="Covers (pax)"
                  />
                )}
              />
              <form.AppField
                name="shape"
                children={(field) => (
                  <field.SelectField
                    label="Shape"
                    required
                    options={[...tableShapeOptions]}
                    placeholder="Select shape"
                  />
                )}
              />
              <form.AppField
                name="sort_order"
                children={(field) => (
                  <field.TextField label="Sort Order" type="number" placeholder="0" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="status"
                children={(field) => (
                  <field.SelectField
                    label="Status"
                    required
                    options={[...tableStatusOptions]}
                    placeholder="Select status"
                  />
                )}
              />
              <form.AppField
                name="is_active"
                children={(field) => (
                  <field.SwitchField label="Active" description="Available for seating" />
                )}
              />
            </div>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>{isEdit ? "Update Table" : "Create Table"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

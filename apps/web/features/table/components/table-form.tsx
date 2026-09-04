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
import { toast } from "sonner";
import { createTable, updateTable } from "../api/service";
import { tableKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { RestaurantTable } from "../api/types";
import { floorsQueryOptions } from "@/features/floor/api/queries";

export default function TableForm({
  initialData,
  pageTitle,
}: {
  initialData: RestaurantTable | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const { data: floors } = useQuery(floorsQueryOptions());
  const floorOptions = (floors ?? [])
    .filter((f) => f.is_active)
    .map((f) => ({ label: `${f.name} (${f.code})`, value: f.id }));

  const createMutation = useMutation({
    mutationFn: (values: TableValues) => createTable(values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success("Table created");
      router.push("/dashboard/settings/outlet/tables");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create table. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: TableValues) => updateTable(initialData!.id, values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success("Table updated");
      router.push("/dashboard/settings/outlet/tables");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update table. Try again."),
  });

  const form = useAppForm({
    defaultValues: {
      floor_id: initialData?.floor_id ?? "",
      number: initialData?.number ?? "",
      code: initialData?.code ?? "",
      capacity: initialData?.capacity ?? 2,
      shape: initialData?.shape ?? "square",
      status: initialData?.status ?? "available",
      sort_order: initialData?.sort_order ?? 0,
      is_active: initialData?.is_active ?? true,
    } as TableValues,
    validators: { onSubmit: tableSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
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

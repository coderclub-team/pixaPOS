"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { floorSchema, type FloorValues } from "../schemas/floor";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFloor, updateFloor } from "../api/service";
import { floorKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Floor } from "../api/types";

export default function FloorForm({
  initialData,
  pageTitle,
}: {
  initialData: Floor | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation({
    mutationFn: (values: FloorValues) => createFloor(values as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor created");
      router.push("/dashboard/settings/outlet/floors");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create floor."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: FloorValues) => updateFloor(initialData!.id, values as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor updated");
      router.push("/dashboard/settings/outlet/floors");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update floor."),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      code: initialData?.code ?? "",
      description: initialData?.description ?? "",
      level: initialData?.level ?? 0,
      capacity: initialData?.capacity ?? 20,
      sort_order: initialData?.sort_order ?? 0,
      is_active: initialData?.is_active ?? true,
      is_outdoor: initialData?.is_outdoor ?? false,
      width_mm: initialData?.width_mm ?? 12000,
      height_mm: initialData?.height_mm ?? 8000,
      grid_size_mm: initialData?.grid_size_mm ?? 100,
      background_color: initialData?.background_color ?? "#ffffff",
      background_image_url: initialData?.background_image_url ?? "",
    } as any,
    validators: { onSubmit: floorSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
        <CardDescription>Floor details and geometry.</CardDescription>
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField label="Floor Name *" required placeholder="Ground Floor" />
                )}
              />
              <form.AppField
                name="code"
                children={(field) => (
                  <field.TextField label="Code *" required placeholder="GF" description="Short code" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="level"
                children={(field) => (
                  <field.TextField label="Level" type="number" placeholder="0" description="0=Ground, 1=First..." />
                )}
              />
              <form.AppField
                name="capacity"
                children={(field) => (
                  <field.TextField label="Capacity" type="number" placeholder="50" description="Headcount" />
                )}
              />
              <form.AppField
                name="sort_order"
                children={(field) => (
                  <field.TextField label="Sort Order" type="number" placeholder="1" />
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="width_mm"
                children={(field) => (
                  <field.TextField label="Width (mm)" type="number" placeholder="12000" />
                )}
              />
              <form.AppField
                name="height_mm"
                children={(field) => (
                  <field.TextField label="Height (mm)" type="number" placeholder="8000" />
                )}
              />
              <form.AppField
                name="grid_size_mm"
                children={(field) => (
                  <field.TextField label="Grid Size (mm)" type="number" placeholder="100" />
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="is_outdoor"
                children={(field) => (
                  <field.SwitchField label="Outdoor Area" />
                )}
              />
              <form.AppField
                name="is_active"
                children={(field) => (
                  <field.SwitchField label="Active" />
                )}
              />
            </div>

            <form.AppField
              name="description"
              children={(field) => (
                <field.TextareaField label="Description" placeholder="Main area..." rows={2} />
              )}
            />
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>{isEdit ? "Update Floor" : "Create Floor"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

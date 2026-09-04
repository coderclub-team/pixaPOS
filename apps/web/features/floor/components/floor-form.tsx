"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
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
    mutationFn: (values: FloorValues) => createFloor(values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor created");
      router.push("/dashboard/settings/outlet/floors");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create floor. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: FloorValues) => updateFloor(initialData!.id, values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor updated");
      router.push("/dashboard/settings/outlet/floors");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update floor. Try again."),
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
    } as FloorValues,
    validators: { onSubmit: floorSchema },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync(value);
      } else {
        await createMutation.mutateAsync(value);
      }
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField label="Floor Name" required placeholder="Ground Floor" />
                )}
              />
              <form.AppField
                name="code"
                children={(field) => <field.TextField label="Code" required placeholder="FL-GF" />}
              />
            </div>
            <form.AppField
              name="description"
              children={(field) => (
                <field.TextareaField
                  label="Description"
                  placeholder="Main dining, street level"
                  rows={2}
                  maxLength={200}
                />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="level"
                children={(field) => (
                  <field.TextField
                    label="Level"
                    type="number"
                    placeholder="0"
                    description="-1 basement, 0 ground"
                  />
                )}
              />
              <form.AppField
                name="capacity"
                children={(field) => (
                  <field.TextField label="Capacity" required type="number" placeholder="80" />
                )}
              />
              <form.AppField
                name="sort_order"
                children={(field) => (
                  <field.TextField
                    label="Sort Order"
                    type="number"
                    placeholder="0"
                    description="Display priority"
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="is_active"
                children={(field) => (
                  <field.SwitchField
                    label="Active"
                    description="Visible for service and order assignment"
                  />
                )}
              />
              <form.AppField
                name="is_outdoor"
                children={(field) => (
                  <field.SwitchField label="Outdoor" description="Rooftop / patio / open-air" />
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
                <form.SubmitButton>{isEdit ? "Update Floor" : "Create Floor"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

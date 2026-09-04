"use client";

import { useAppForm } from "@/lib/form";
import { floorSchema, type FloorValues } from "../schemas/floor";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFloor, updateFloor } from "../api/service";
import { floorKeys } from "../api/queries";
import { toast } from "sonner";
import type { Floor } from "../api/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { FieldGroup } from "@pixa/ui/base-ui/field";

interface FloorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floor?: Floor | null;
}

export function FloorFormDialog({ open, onOpenChange, floor }: FloorFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(floor);

  const mutation = useMutation({
    mutationFn: (values: FloorValues) =>
      isEditing && floor ? updateFloor(floor.id, values) : createFloor(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floorKeys.all });
      toast.success(isEditing ? "Floor updated" : "Floor created");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save floor"),
  });

  const form = useAppForm({
    defaultValues: {
      name: floor?.name ?? "",
      code: floor?.code ?? "",
      description: floor?.description ?? "",
      level: floor?.level ?? 0,
      capacity: floor?.capacity ?? 20,
      sort_order: floor?.sort_order ?? 0,
      is_active: floor?.is_active ?? true,
      is_outdoor: floor?.is_outdoor ?? false,
    } as FloorValues,
    validators: { onSubmit: floorSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  // Reset form when floor changes or dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
    } else if (floor) {
      form.setFieldValue("name", floor.name);
      form.setFieldValue("code", floor.code);
      form.setFieldValue("description", floor.description ?? "");
      form.setFieldValue("level", floor.level);
      form.setFieldValue("capacity", floor.capacity);
      form.setFieldValue("sort_order", floor.sort_order);
      form.setFieldValue("is_active", floor.is_active);
      form.setFieldValue("is_outdoor", floor.is_outdoor ?? false);
    } else {
      form.reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Floor" : "Add Floor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update floor details for this outlet."
              : "Create a new floor / serving area."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
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
                    description="-1 basement"
                  />
                )}
              />
              <form.AppField
                name="capacity"
                children={(field) => (
                  <field.TextField label="Capacity" type="number" required placeholder="80" />
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
                name="is_active"
                children={(field) => (
                  <field.SwitchField label="Active" description="Visible for service" />
                )}
              />
              <form.AppField
                name="is_outdoor"
                children={(field) => (
                  <field.SwitchField label="Outdoor" description="Rooftop / patio" />
                )}
              />
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <form.AppForm
              children={
                <form.SubmitButton>{isEditing ? "Update Floor" : "Create Floor"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

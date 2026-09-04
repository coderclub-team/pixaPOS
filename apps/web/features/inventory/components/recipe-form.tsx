"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { recipeSchema, type RecipeValues } from "../schemas/recipe";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRecipe, updateRecipe } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Recipe } from "../api/types";

export default function RecipeForm({
  initialData,
  pageTitle,
}: {
  initialData: Recipe | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  // Simplified: keep ingredients as is for edit, for new provide empty stub that user will replace via JSON? For MVP, use default 1 ingredient.
  const defaultIngredients = initialData?.ingredients ?? [
    { material_id: "", qty: 0.2, unit: "kg" },
  ];

  const createMutation = useMutation({
    mutationFn: (v: RecipeValues) => createRecipe(v as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe created");
      router.push("/dashboard/inventory/recipes");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: RecipeValues) => updateRecipe(initialData!.id, v as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe updated");
      router.push("/dashboard/inventory/recipes");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      yields: initialData?.yields ?? 1,
      ingredients: defaultIngredients as any,
      selling_price: initialData?.selling_price ?? 0,
      is_active: initialData?.is_active ?? true,
    } as RecipeValues,
    validators: { onSubmit: recipeSchema },
    onSubmit: async ({ value }) =>
      isEdit ? updateMutation.mutateAsync(value) : createMutation.mutateAsync(value),
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
              name="name"
              children={(field) => (
                <field.TextField label="Recipe Name" required placeholder="Chicken Biryani" />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="yields"
                children={(field) => (
                  <field.TextField label="Yields" type="number" placeholder="1" />
                )}
              />
              <form.AppField
                name="selling_price"
                children={(field) => (
                  <field.TextField label="Selling Price" type="number" placeholder="299" />
                )}
              />
              <form.AppField
                name="is_active"
                children={(field) => <field.SwitchField label="Active" />}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Ingredients are seeded for demo (edit via BOM). Cost per serve auto-calculated from
              material avg costs.
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={<form.SubmitButton>{isEdit ? "Update" : "Create"}</form.SubmitButton>}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

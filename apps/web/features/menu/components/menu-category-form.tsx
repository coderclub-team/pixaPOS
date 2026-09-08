"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMenuCategory, updateMenuCategory } from "../api/service";
import { menuKeys, menuCategoriesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { MenuCategory } from "../api/types";
import { Icons } from "@pixa/ui/icons";

export default function MenuCategoryForm({
  initialData,
  pageTitle,
}: {
  initialData?: MenuCategory | null;
  pageTitle?: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const { data: categories } = useQuery(menuCategoriesQueryOptions());
  const parentOptions = (categories ?? [])
    .filter((c) => c.id !== initialData?.id)
    .map((c) => ({ label: c.name, value: c.id }));

  const createMut = useMutation({
    mutationFn: (v: any) => createMenuCategory(v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Category created");
      router.push("/dashboard/menu/categories");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: any) => updateMenuCategory(initialData!.id, v),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Category updated");
      router.push("/dashboard/menu/categories");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      parent_id: initialData?.parent_id ?? "",
      is_active: initialData?.is_active ?? true,
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.name) return { name: "Name required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      if (isEdit) await updateMut.mutateAsync(value);
      else await createMut.mutateAsync(value);
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">
              {pageTitle ?? (isEdit ? "Update Category" : "New Category")}
            </CardTitle>
            <CardDescription>
              Category — name, description, parent (optional), image placeholder not used this
              phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField label="Name *" required placeholder="Starters" />
                )}
              />
              <form.AppField
                name="description"
                children={(field) => (
                  <field.TextareaField
                    label="Description"
                    placeholder="Category description..."
                    rows={2}
                  />
                )}
              />
              <form.AppField
                name="parent_id"
                children={(field) => (
                  <field.SelectField
                    label="Parent Category"
                    options={parentOptions}
                    placeholder="Top level — no parent"
                    description="Odoo parent category, flat if empty"
                  />
                )}
              />
              <form.AppField
                name="is_active"
                children={(field) => (
                  <field.SwitchField label="Active" description="Visible in POS" />
                )}
              />
              <div className="rounded-lg border border-dashed p-6 text-center">
                <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                  <Icons.upload className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Image upload placeholder</p>
                  <p className="text-xs text-muted-foreground">
                    Not used this phase — will store image_url later{" "}
                    {initialData?.image_url ? `• Current: ${initialData.image_url}` : ""}
                  </p>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Upload image (coming soon)
                  </Button>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <form.AppForm
            children={<form.SubmitButton>{isEdit ? "Update" : "Create"}</form.SubmitButton>}
          />
        </div>
      </form>
    </div>
  );
}

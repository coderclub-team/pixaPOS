"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { userSchema, type UserFormValues } from "../schemas/user";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUser, updateUser } from "../api/service";
import { getQueryClient } from "@/lib/query-client";
import { userKeys } from "../api/queries";
import type { User } from "../api/types";
import { ROLE_OPTIONS } from "./users-table/options";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Invited", label: "Invited" },
];

export default function UserForm({
  initialData,
  pageTitle,
}: {
  initialData: User | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => createUser(values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: userKeys.all });
      toast.success("User created");
      router.push("/dashboard/users");
    },
    onError: () => toast.error("Couldn't create user. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) => updateUser(initialData!.id, values),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: userKeys.all });
      toast.success("User updated");
      router.push("/dashboard/users");
    },
    onError: () => toast.error("Couldn't update user. Try again."),
  });

  const form = useAppForm({
    defaultValues: {
      first_name: initialData?.first_name ?? "",
      last_name: initialData?.last_name ?? "",
      email: initialData?.email ?? "",
      phone: initialData?.phone ?? "",
      role: initialData?.role ?? "",
      status: initialData?.status ?? "Active",
    } as UserFormValues,
    validators: { onSubmit: userSchema },
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
            <div className="grid grid-cols-2 gap-4">
              <form.AppField
                name="first_name"
                children={(field) => (
                  <field.TextField label="First Name" required placeholder="John" />
                )}
              />
              <form.AppField
                name="last_name"
                children={(field) => (
                  <field.TextField label="Last Name" required placeholder="Doe" />
                )}
              />
            </div>

            <form.AppField
              name="email"
              children={(field) => (
                <field.TextField
                  label="Email"
                  required
                  type="email"
                  placeholder="john@example.com"
                />
              )}
            />

            <form.AppField
              name="phone"
              children={(field) => (
                <field.TextField label="Phone" required type="tel" placeholder="(555) 123-4567" />
              )}
            />

            <form.AppField
              name="role"
              children={(field) => (
                <field.SelectField
                  label="Role"
                  required
                  options={ROLE_OPTIONS}
                  placeholder="Select role"
                  description="POS role determines floor/table/order access"
                />
              )}
            />

            <form.AppField
              name="status"
              children={(field) => (
                <field.SelectField
                  label="Status"
                  required
                  options={STATUS_OPTIONS}
                  placeholder="Select status"
                />
              )}
            />
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>{isEdit ? "Update User" : "Create User"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

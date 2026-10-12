"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { employeeSchema, type EmployeeFormValues } from "../schemas/payroll";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEmployee, updateEmployee } from "../api/service";
import { payrollKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Employee } from "../api/types";

export default function EmployeeForm({ initialData }: { initialData?: Employee }) {
  const router = useRouter();
  const isEdit = !!initialData;

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      const payload = {
        name: values.name,
        email: values.email || undefined,
        employee_code: values.employee_code,
        pay_type: values.pay_type,
        rate: values.rate,
        currency: values.currency || undefined,
        bank_account: values.bank_account || undefined,
        status: values.status,
        outlet_id: undefined,
        joining_date: values.joining_date || undefined,
      };
      return isEdit ? updateEmployee(initialData.id, payload) : createEmployee(payload);
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: payrollKeys.employees() });
      toast.success(isEdit ? "Employee updated" : "Employee added");
      router.push("/dashboard/payroll/employees");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      email: initialData?.email ?? "",
      employee_code: initialData?.employee_code ?? "",
      pay_type: initialData?.pay_type ?? "salary",
      rate: initialData?.rate ?? 0,
      currency: initialData?.currency ?? "INR",
      bank_account: "",
      status: initialData?.status ?? "active",
      joining_date: initialData?.joining_date ?? "",
    } as EmployeeFormValues,
    validators: { onSubmit: employeeSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">
          {isEdit ? "Edit Employee" : "Add Employee"}
        </CardTitle>
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
                  <field.TextField label="Full Name" required placeholder="Ravi Kumar" />
                )}
              />
              <form.AppField
                name="employee_code"
                children={(field) => (
                  <field.TextField label="Employee Code" required placeholder="EMP001" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField
                    label="Email"
                    type="email"
                    placeholder="Link to login for self-service"
                  />
                )}
              />
              <form.AppField
                name="status"
                children={(field) => (
                  <field.SelectField
                    label="Status"
                    required
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <form.AppField
                name="pay_type"
                children={(field) => (
                  <field.SelectField
                    label="Pay Type"
                    required
                    options={[
                      { value: "salary", label: "Monthly salary" },
                      { value: "hourly", label: "Hourly wage" },
                    ]}
                    description="Salary = monthly amount; hourly = per-hour rate"
                  />
                )}
              />
              <form.AppField
                name="rate"
                children={(field) => (
                  <field.TextField label="Rate (₹)" required type="number" placeholder="30000" />
                )}
              />
              <form.AppField
                name="currency"
                children={(field) => <field.TextField label="Currency" placeholder="INR" />}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="bank_account"
                children={(field) => (
                  <field.TextField
                    label={isEdit ? "Bank Account (leave blank to keep)" : "Bank Account"}
                    placeholder="Encrypted at rest"
                    description="Stored encrypted, only last-4 shown"
                  />
                )}
              />
              <form.AppField
                name="joining_date"
                children={(field) => <field.TextField label="Joining Date" type="date" />}
              />
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>{isEdit ? "Update Employee" : "Add Employee"}</form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

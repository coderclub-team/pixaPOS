"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { leaveRequestSchema, type LeaveRequestValues } from "../schemas/payroll";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyLeave } from "../api/service";
import { payrollKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";

export default function LeaveApplyForm({
  employees,
  types,
  fixedEmployeeId,
}: {
  employees: { id: string; name: string }[];
  types: { id: string; name: string; is_paid: boolean; unit: string }[];
  fixedEmployeeId?: string;
}) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (values: LeaveRequestValues) =>
      applyLeave({
        employee_id: fixedEmployeeId ?? values.employee_id,
        leave_type_id: values.leave_type_id,
        start_date: values.start_date,
        end_date: values.end_date,
        is_half_day: values.is_half_day,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: payrollKeys.leaves() });
      toast.success("Leave request submitted");
      router.push(fixedEmployeeId ? "/dashboard/payroll/me" : "/dashboard/payroll/leaves");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);
  const form = useAppForm({
    defaultValues: {
      employee_id: fixedEmployeeId ?? "",
      leave_type_id: "",
      start_date: today,
      end_date: today,
      is_half_day: false,
      reason: "",
    } as LeaveRequestValues,
    validators: { onSubmit: leaveRequestSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">Request Leave</CardTitle>
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
            {!fixedEmployeeId && (
              <form.AppField
                name="employee_id"
                children={(field) => (
                  <field.SelectField
                    label="Employee"
                    required
                    options={employees.map((e) => ({ value: e.id, label: e.name }))}
                  />
                )}
              />
            )}
            <form.AppField
              name="leave_type_id"
              children={(field) => (
                <field.SelectField
                  label="Leave Type"
                  required
                  options={types.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.is_paid ? "" : " (unpaid)"}`,
                  }))}
                />
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="start_date"
                children={(field) => <field.TextField label="Start Date" required type="date" />}
              />
              <form.AppField
                name="end_date"
                children={(field) => <field.TextField label="End Date" required type="date" />}
              />
            </div>
            <form.AppField
              name="is_half_day"
              children={(field) => <field.CheckboxField label="Half day (counts as 0.5 day)" />}
            />
            <form.AppField
              name="reason"
              children={(field) => (
                <field.TextField label="Reason" placeholder="Fever, family function..." />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm children={<form.SubmitButton>Submit Request</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

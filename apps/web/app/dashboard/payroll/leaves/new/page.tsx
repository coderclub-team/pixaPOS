"use client";

import PageContainer from "@/components/layout/page-container";
import LeaveApplyForm from "@/features/payroll/components/leave-apply-form";
import { employeesQueryOptions, leaveTypesQueryOptions } from "@/features/payroll/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function NewLeavePage() {
  const { data: employees } = useQuery(employeesQueryOptions);
  const { data: types } = useQuery(leaveTypesQueryOptions);

  return (
    <PageContainer pageTitle="Apply Leave" pageDescription="Payroll — New leave request">
      <LeaveApplyForm
        employees={(employees ?? []).map((e) => ({ id: e.id, name: e.name }))}
        types={(types ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          is_paid: t.is_paid,
          unit: t.unit,
        }))}
      />
    </PageContainer>
  );
}

"use client";

import PageContainer from "@pixa/ui/layout/page-container";
import LeaveApplyForm from "@/features/payroll/components/leave-apply-form";
import { leaveTypesQueryOptions, myProfileQueryOptions } from "@/features/payroll/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function MyApplyLeavePage() {
  const { data: types } = useQuery(leaveTypesQueryOptions);
  const { data: profile } = useQuery(myProfileQueryOptions);
  const employeeId = profile?.employee?.id;

  if (!employeeId) {
    return (
      <PageContainer pageTitle="Apply Leave" pageDescription="Payroll — Self service" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer pageTitle="Apply Leave" pageDescription="Payroll — New leave request">
      <LeaveApplyForm
        employees={[]}
        types={(types ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          is_paid: t.is_paid,
        }))}
        fixedEmployeeId={employeeId}
      />
    </PageContainer>
  );
}

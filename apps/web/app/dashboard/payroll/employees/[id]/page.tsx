"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import EmployeeForm from "@/features/payroll/components/employee-form";
import { employeesQueryOptions } from "@/features/payroll/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { data: employees, isPending } = useQuery(employeesQueryOptions);
  const employee = (employees ?? []).find((e) => e.id === id) ?? null;

  if (isPending) {
    return (
      <PageContainer pageTitle="Edit Employee" isLoading>
        <div />
      </PageContainer>
    );
  }
  if (!employee) {
    return (
      <PageContainer pageTitle="Edit Employee" pageDescription="Payroll — Employee not found">
        <p className="text-sm text-muted-foreground">No employee with this id.</p>
      </PageContainer>
    );
  }
  return (
    <PageContainer pageTitle="Edit Employee" pageDescription={`Payroll — ${employee.name}`}>
      <EmployeeForm initialData={employee} />
    </PageContainer>
  );
}

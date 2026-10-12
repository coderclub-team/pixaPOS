"use client";

import * as React from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { LeaveList } from "@/features/payroll/components/leave-list";
import {
  employeesQueryOptions,
  leavesQueryOptions,
  leaveBalancesQueryOptions,
  leaveTypesQueryOptions,
} from "@/features/payroll/api/queries";

export default function LeavesPage() {
  const [status, setStatus] = React.useState<string>("pending");
  const { data: leaves, isPending } = useQuery(leavesQueryOptions({ status }));
  const { data: employees } = useQuery(employeesQueryOptions);
  const { data: types } = useQuery(leaveTypesQueryOptions);
  const year = new Date().getFullYear();
  const { data: balances } = useQuery(leaveBalancesQueryOptions(year));

  if (isPending) {
    return (
      <PageContainer pageTitle="Leave Requests" pageDescription="Payroll — Leave" isLoading>
        <div />
      </PageContainer>
    );
  }

  const empName = (id: string) => employees?.find((e) => e.id === id)?.name ?? id;
  const typeName = (id: string) => types?.find((t) => t.id === id)?.name ?? id;

  return (
    <PageContainer
      pageTitle="Leave Requests"
      pageDescription="Approve staff leave. Paid balances deduct automatically; unpaid days flow into payroll."
      pageHeaderAction={
        <Link
          href="/dashboard/payroll/leaves/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Apply Leave
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {balances && balances.length > 0 && status === "pending" && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Year {year} balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              {balances.slice(0, 12).map((b) => (
                <div key={b.id} className="rounded border p-2">
                  <div className="font-medium">{empName(b.employee_id)}</div>
                  <div className="text-muted-foreground">
                    {typeName(b.leave_type_id)}: {b.remaining}/{b.quota} left
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <LeaveList
        leaves={leaves ?? []}
        canApprove
        employees={(employees ?? []).map((e) => ({ id: e.id, name: e.name }))}
        types={(types ?? []).map((t) => ({ id: t.id, name: t.name }))}
      />
    </PageContainer>
  );
}

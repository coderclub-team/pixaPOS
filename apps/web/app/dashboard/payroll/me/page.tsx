"use client";

import Link from "next/link";
import PageContainer from "@pixa/ui/layout/page-container";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { inr } from "@/features/payroll/components/employee-list";
import {
  myBalancesQueryOptions,
  myLeavesQueryOptions,
  myPayslipsQueryOptions,
  myProfileQueryOptions,
} from "@/features/payroll/api/queries";

export default function MyPayrollPage() {
  const { data: profile, isPending } = useQuery(myProfileQueryOptions);
  const year = new Date().getFullYear();
  const { data: balances } = useQuery(myBalancesQueryOptions(year));
  const { data: requests } = useQuery(myLeavesQueryOptions);
  const { data: payslips } = useQuery(myPayslipsQueryOptions);
  const employee = profile?.employee ?? null;

  if (isPending) {
    return (
      <PageContainer pageTitle="My Payroll" pageDescription="Payroll — Self service" isLoading>
        <div />
      </PageContainer>
    );
  }

  if (!employee) {
    const isManager = profile?.can_manage === true;
    return (
      <PageContainer pageTitle="My Payroll" pageDescription="Payroll — Self service">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isManager ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                <p className="font-medium text-foreground">No employee record for your login</p>
                <p>
                  Owners and managers only see payslips here once they add themselves as an employee
                  — use your login email so this page links up. Staff management lives under
                  Employees and Leave Requests.
                </p>
                <Link
                  href="/dashboard/payroll/employees/new"
                  className={cn(buttonVariants(), "text-xs md:text-sm")}
                >
                  <Icons.add className="mr-2 h-4 w-4" /> Add myself as employee
                </Link>
              </div>
            ) : (
              "No employee record is linked to your login. Ask your manager to add your email to your employee profile."
            )}
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="My Payroll"
      pageDescription={`${employee.name} (${employee.employee_code}) — ${employee.pay_type === "hourly" ? `${inr(employee.rate)}/hr` : `${inr(employee.rate)}/month`}`}
      pageHeaderAction={
        <Link
          href="/dashboard/payroll/me/apply"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Apply Leave
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leave balances {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.leave_type_name ?? b.leave_type_id}
                    </TableCell>
                    <TableCell className="text-right">{b.used}</TableCell>
                    <TableCell className="text-right">{b.remaining}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My leave requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requests ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {r.start_date} → {r.end_date}
                      {r.day_type !== "full" ? " (half)" : ""}
                    </TableCell>
                    <TableCell>{r.total_days}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payslips ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.pay_period_id?.slice(0, 8) ?? "—"}
                    {p.run_status ? ` · ${p.run_status}` : ""}
                  </TableCell>
                  <TableCell className="text-right">{inr(p.gross_pay)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(p.net_pay)}</TableCell>
                  <TableCell className="text-right">
                    {p.payroll_run_id ? (
                      <Link
                        href={`/dashboard/payroll/me/payslip/${p.payroll_run_id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

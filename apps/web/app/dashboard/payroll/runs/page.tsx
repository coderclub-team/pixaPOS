"use client";

import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { cn } from "@pixa/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { inr } from "@/features/payroll/components/employee-list";
import { PayrunWizard } from "@/features/payroll/components/payrun-wizard";
import {
  employeesQueryOptions,
  payrollRunsQueryOptions,
  payPeriodsQueryOptions,
} from "@/features/payroll/api/queries";

export default function PayrollRunsPage() {
  const { data: runs, isPending } = useQuery(payrollRunsQueryOptions);
  const { data: employees } = useQuery(employeesQueryOptions);
  const { data: periods } = useQuery(payPeriodsQueryOptions);

  if (isPending) {
    return (
      <PageContainer pageTitle="Payroll Runs" pageDescription="Payroll — Runs" isLoading>
        <div />
      </PageContainer>
    );
  }

  const periodName = (id: string) => {
    const p = periods?.find((x) => x.id === id);
    return p ? `${p.start_date} → ${p.end_date}` : id;
  };

  return (
    <PageContainer
      pageTitle="Payroll Runs"
      pageDescription="Monthly runs: gross = wage + holiday overtime + incentives, net = gross − unpaid leave − deductions."
    >
      <PayrunWizard employees={employees ?? []} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross total</TableHead>
                <TableHead className="text-right">Net total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{periodName(r.pay_period_id)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{inr(r.total_gross)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(r.total_net)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/payroll/runs/${r.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Open
                    </Link>
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

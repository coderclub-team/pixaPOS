"use client";

import * as React from "react";
import PageContainer from "@pixa/ui/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { inr } from "@/features/payroll/components/employee-list";
import { myProfileQueryOptions, payrollRunQueryOptions } from "@/features/payroll/api/queries";

const fmt = (rupees: number) => inr(rupees);

export default function PayslipPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = React.use(params);
  const { data, isPending } = useQuery(payrollRunQueryOptions(runId));
  const { data: profile } = useQuery(myProfileQueryOptions);

  if (isPending || !data) {
    return (
      <PageContainer pageTitle="Payslip" isLoading>
        <div />
      </PageContainer>
    );
  }

  const myId = profile?.employee?.id;
  const item = data.items.find((i) => i.employee_id === myId) ?? data.items[0];
  if (!item) {
    return (
      <PageContainer pageTitle="Payslip" pageDescription="No payslip in this run">
        <p className="text-sm text-muted-foreground">This run has no items for you.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Payslip"
      pageDescription={`${item.employee_name ?? item.employee_id} — ${data.run.pay_period_id}`}
      pageHeaderAction={
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Icons.printer className="mr-2 h-4 w-4" /> Print
        </Button>
      }
    >
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-left text-xl">Payslip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Employee</div>
            <div className="font-medium">{item.employee_name ?? item.employee_id}</div>
            <div className="text-muted-foreground">Period</div>
            <div>{data.run.pay_period_id}</div>
          </div>
          <div className="border-t pt-3">
            <div className="font-medium">Earnings</div>
            <Row label="Base wage" value={item.gross_wage} />
            <Row label="Holiday overtime" value={item.holiday_extra} />
            {item.incentives.map((x) => (
              <Row key={x.id} label={x.name} value={x.amount} />
            ))}
            <Row label="Gross pay" value={item.gross_pay} bold />
          </div>
          <div className="border-t pt-3">
            <div className="font-medium">Deductions</div>
            <Row label="Unpaid leave" value={item.unpaid_leave_deduction} />
            <Row label="Other deductions" value={item.deductions} />
          </div>
          <div className="border-t pt-3">
            <Row label="Net pay" value={item.net_pay} bold large />
            {item.notes && <p className="text-xs text-muted-foreground">Note: {item.notes}</p>}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function Row({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-0.5 ${bold ? "font-semibold" : ""} ${large ? "text-lg" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{fmt(value)}</span>
    </div>
  );
}

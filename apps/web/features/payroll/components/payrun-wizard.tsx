"use client";

import * as React from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { payPeriodsQueryOptions, payrollKeys } from "../api/queries";
import { createPayPeriod as apiCreatePeriod, createPayrollRun } from "../api/service";
import { getQueryClient } from "@/lib/query-client";
import type { Employee } from "../api/types";

export function PayrunWizard({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const { data: periods } = useQuery(payPeriodsQueryOptions);
  const [periodId, setPeriodId] = React.useState("");
  const [hours, setHours] = React.useState<Record<string, string>>({});

  // New period fields
  const [newStart, setNewStart] = React.useState("");
  const [newEnd, setNewEnd] = React.useState("");

  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.periods() });
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.runs() });
  };

  const periodMutation = useMutation({
    mutationFn: () => apiCreatePeriod(newStart, newEnd),
    onSuccess: () => {
      invalidate();
      setNewStart("");
      setNewEnd("");
      toast.success("Pay period created — select it above");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: () =>
      createPayrollRun(
        periodId,
        Object.entries(hours)
          .filter(([, v]) => v !== "" && Number(v) > 0)
          .map(([employee_id, v]) => ({ employee_id, working_units: Number(v) })),
      ),
    onSuccess: (run) => {
      invalidate();
      toast.success(
        run.unmarkedDays > 0
          ? `Payroll run created · ${run.unmarkedDays} unmarked attendance day(s) assumed present`
          : "Payroll run created",
      );
      router.push(`/dashboard/payroll/runs/${run.runId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPeriods = (periods ?? []).filter((p) => p.status === "open");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pay period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an open period" />
            </SelectTrigger>
            <SelectContent>
              {openPeriods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.start_date} → {p.end_date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="max-w-[160px]"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newStart || !newEnd || periodMutation.isPending}
              onClick={() => periodMutation.mutate()}
            >
              New period
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Hours & run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter total hours per active employee only to override the attendance register — hourly
            hours and salary working days otherwise come from attendance (unmarked days count as
            present).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pay</TableHead>
                <TableHead>Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees
                .filter((e) => e.status === "active")
                .map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-xs">{e.pay_type}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={hours[e.id] ?? ""}
                        onChange={(ev) => setHours((h) => ({ ...h, [e.id]: ev.target.value }))}
                        className="max-w-[100px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <Button
            disabled={!periodId || runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            Create payroll run
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

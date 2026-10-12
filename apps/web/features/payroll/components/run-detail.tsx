"use client";

import * as React from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pixa/ui/base-ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { inr } from "./employee-list";
import { addIncentive, approveRun, overrideItem } from "../api/service";
import { payrollKeys, payrollRunQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";

const fmt = (rupees: number) => inr(rupees);

export function RunDetail({ runId }: { runId: string }) {
  const { data, isPending } = useQuery(payrollRunQueryOptions(runId));
  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.run(runId) });
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.runs() });
  };

  const approve = useMutation({
    mutationFn: () => approveRun(runId),
    onSuccess: () => {
      invalidate();
      toast.success("Run approved — payslips ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading run…
        </CardContent>
      </Card>
    );
  }

  const locked = data.run.status !== "draft";
  const totalNet = data.items.reduce((s, i) => s + i.net_pay, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {data.run.pay_period_id}
            <Badge variant={locked ? "default" : "secondary"}>{data.run.status}</Badge>
            <span className="ml-auto text-lg">{fmt(totalNet)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!locked && (
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
              Approve run
            </Button>
          )}
          <a
            href={`/api/payroll/runs/${runId}/export`}
            className="inline-flex items-center gap-1 text-sm underline"
          >
            <Icons.download className="h-4 w-4" /> Export summary CSV
          </a>
          <a
            href={`/api/payroll/runs/${runId}/export?format=disburse`}
            className="inline-flex items-center gap-1 text-sm underline"
          >
            <Icons.download className="h-4 w-4" /> Disbursement file (bank/UPI)
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.employee_name ?? item.employee_id}</div>
                    <div className="text-xs text-muted-foreground">
                      wage {fmt(item.gross_wage)} · holiday {fmt(item.holiday_extra)} · incentives{" "}
                      {fmt(item.total_incentives)} · unpaid {fmt(item.unpaid_leave_deduction)}
                      {item.notes ? ` · note: ${item.notes}` : ""}
                    </div>
                    {item.incentives.length > 0 && (
                      <div className="text-xs">
                        {item.incentives.map((x) => `${x.name} ${fmt(x.amount)}`).join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{fmt(item.gross_pay)}</TableCell>
                  <TableCell className="text-right">
                    {fmt(item.unpaid_leave_deduction + item.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(item.net_pay)}</TableCell>
                  <TableCell className="text-right">
                    {!locked && (
                      <div className="flex justify-end gap-1">
                        <IncentiveDialog runId={runId} itemId={item.id} onDone={invalidate} />
                        <OverrideDialog
                          runId={runId}
                          itemId={item.id}
                          currentDeductions={item.deductions}
                          onDone={invalidate}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function IncentiveDialog({
  runId,
  itemId,
  onDone,
}: {
  runId: string;
  itemId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const mut = useMutation({
    mutationFn: () =>
      addIncentive(runId, { payroll_item_id: itemId, name, amount: Number(amount) }),
    onSuccess: () => {
      onDone();
      setOpen(false);
      setName("");
      setAmount("");
      toast.success("Incentive added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Bonus
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add incentive</DialogTitle>
          <DialogDescription>
            Tips, festival bonus, performance pay — adds to gross.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Diwali bonus"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Amount ₹"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            size="sm"
            disabled={!name || !amount || mut.isPending}
            onClick={() => mut.mutate()}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function OverrideDialog({
  runId,
  itemId,
  currentDeductions,
  onDone,
}: {
  runId: string;
  itemId: string;
  currentDeductions: number;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [deductions, setDeductions] = React.useState(String(currentDeductions));
  const [reason, setReason] = React.useState("");
  const mut = useMutation({
    mutationFn: () =>
      overrideItem(runId, itemId, { deductions: Number(deductions), notes: reason }),
    onSuccess: () => {
      onDone();
      setOpen(false);
      toast.success("Deductions updated — totals re-derived");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Adjust
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust deductions</DialogTitle>
          <DialogDescription>
            Sets other deductions (₹); net re-derives. The note is stored on the item.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Deductions ₹"
            type="number"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
          />
          <Input
            placeholder="Reason (stored as note)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button size="sm" disabled={!deductions || mut.isPending} onClick={() => mut.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

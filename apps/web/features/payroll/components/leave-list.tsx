"use client";

import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { decideLeave } from "../api/service";
import { payrollKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { LeaveRequest } from "../api/types";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export function LeaveList({
  leaves,
  canApprove,
  employees,
  types,
}: {
  leaves: LeaveRequest[];
  canApprove: boolean;
  employees: { id: string; name: string }[];
  types: { id: string; name: string }[];
}) {
  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.leaves() });
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.balances() });
  };
  const approve = useMutation({
    mutationFn: (id: string) => decideLeave(id, "approve"),
    onSuccess: () => {
      invalidate();
      toast.success("Leave approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => decideLeave(id, "reject", "Rejected by manager"),
    onSuccess: () => {
      invalidate();
      toast.success("Leave rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? id;

  if (leaves.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.calendar className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No leave requests</p>
            <p className="text-sm text-muted-foreground">
              Staff requests appear here for approval.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{empName(l.employee_id)}</TableCell>
                <TableCell>{typeName(l.leave_type_id)}</TableCell>
                <TableCell className="text-xs">
                  {l.start_date} → {l.end_date}
                  {l.day_type !== "full" ? " (half day)" : ""}
                </TableCell>
                <TableCell>{l.total_days}</TableCell>
                <TableCell>
                  <StatusBadge status={l.status} />
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {l.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate(l.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={reject.isPending}
                          onClick={() => reject.mutate(l.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

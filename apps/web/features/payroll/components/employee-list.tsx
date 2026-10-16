"use client";

import { useRouter } from "next/navigation";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { Icons } from "@pixa/ui/icons";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getQueryClient } from "@/lib/query-client";
import { SortTh, useSorting } from "@pixa/ui/sort-th";
import { verificationLabel } from "./employee-form";
import { payrollKeys } from "../api/queries";
import { updateEmployee, verifyEmployee } from "../api/service";
import type { Employee } from "../api/types";

export function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function EmployeeList({ employees }: { employees: Employee[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<Employee>("name");
  const rows = sorted(employees, {
    name: (e) => e.name,
    code: (e) => e.employee_code,
    pay: (e) => e.rate,
    status: (e) => e.status,
  });

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.user className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No employees yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first employee — hourly or salaried — to run payroll.
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
              <TableHead>
                <SortTh
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Code"
                  column="code"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>Pay</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>
                <SortTh
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.email || "—"}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                <TableCell className="text-sm">
                  {inr(e.rate)}
                  <span className="text-muted-foreground">
                    /{e.pay_type === "hourly" ? "hr" : "mo"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div>{e.bank_account_masked}</div>
                  {(e.bank_name || e.bank_ifsc) && (
                    <div className="text-muted-foreground">
                      {[e.bank_name, e.bank_ifsc].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {e.upi_id_masked !== "—" && (
                    <div className="text-muted-foreground">UPI {e.upi_id_masked}</div>
                  )}
                  <div className="text-muted-foreground">
                    {verificationLabel(e.verification_status)}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusDot isActive={e.status === "active"} />
                </TableCell>
                <TableCell className="text-right">
                  <EmployeeActions employee={e} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmployeeActions({ employee }: { employee: Employee }) {
  const router = useRouter();
  const invalidate = () =>
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.employees() });

  const verify = useMutation({
    mutationFn: () => verifyEmployee(employee.id),
    onSuccess: (r) => {
      invalidate();
      const parts = [r.bank.checked && r.bank.detail, r.upi.checked && r.upi.detail].filter(
        Boolean,
      );
      if (r.verification_status === "verified") toast.success(`Verified — ${parts.join(" · ")}`);
      else if (r.verification_status === "unavailable")
        toast.warning(`Verification unavailable — ${parts.join(" · ")}`);
      else toast.error(`Verification failed — ${parts.join(" · ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: () =>
      updateEmployee(employee.id, {
        status: employee.status === "active" ? "inactive" : "active",
      }),
    onSuccess: () => {
      invalidate();
      toast.success(employee.status === "active" ? "Employee deactivated" : "Employee reactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
        <Icons.ellipsis className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/payroll/employees/${employee.id}`)}
          >
            <Icons.edit className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => verify.mutate()} disabled={verify.isPending}>
            <Icons.badgeCheck className="mr-2 h-4 w-4" /> Verify payout details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleStatus.mutate()} disabled={toggleStatus.isPending}>
            <Icons.user className="mr-2 h-4 w-4" />{" "}
            {employee.status === "active" ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

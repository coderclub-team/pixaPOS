"use client";

import Link from "next/link";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
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
import { SortTh, useSorting } from "@/components/sort-th";
import { verificationLabel } from "./employee-form";
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
                  <Link
                    href={`/dashboard/payroll/employees/${e.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

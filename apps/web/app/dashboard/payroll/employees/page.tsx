"use client";

import * as React from "react";
import Link from "next/link";
import PageContainer from "@pixa/ui/layout/page-container";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
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
import { EmployeeList } from "@/features/payroll/components/employee-list";
import { employeesQueryOptions } from "@/features/payroll/api/queries";
import { DataTableSkeleton } from "@pixa/ui/base-ui/table/data-table-skeleton";

export default function EmployeesPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("active");
  const [inputValue, setInputValue] = React.useState("");

  const { data: employees, isPending } = useQuery(employeesQueryOptions);

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  if (isPending) {
    return (
      <PageContainer pageTitle="Employees" pageDescription="Payroll — Employees">
        <div role="status" aria-label="Loading employees">
          <DataTableSkeleton
            columnCount={6}
            rowCount={10}
            filterCount={2}
            cellWidths={["220px", "110px", "120px", "180px", "110px", "56px"]}
          />
        </div>
      </PageContainer>
    );
  }

  const q = search.trim().toLowerCase();
  const rows = (employees ?? []).filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q)) &&
      (!status || status === "all" || e.status === status),
  );

  return (
    <PageContainer
      pageTitle="Employees"
      pageDescription="Hourly and salaried staff. Only active employees appear in payroll runs."
      pageHeaderAction={
        <Link
          href="/dashboard/payroll/employees/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Employee
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name or code..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <EmployeeList employees={rows} />
    </PageContainer>
  );
}

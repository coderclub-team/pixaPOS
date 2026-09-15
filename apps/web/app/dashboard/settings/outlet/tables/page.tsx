"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { TableList } from "@/features/table/components/table-list";
import { tablesQueryOptions } from "@/features/table/api/queries";
import type { TableStatus } from "@/features/table/api/types";
import { useQuery } from "@tanstack/react-query";
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
import Link from "next/link";
import { useQuery as useFloorQuery } from "@tanstack/react-query";
import { floorsQueryOptions } from "@/features/floor/api/queries";

export default function TablesPage() {
  const [search, setSearch] = React.useState("");
  const [floorId, setFloorId] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<TableStatus | undefined>(undefined);
  const [sharing, setSharing] = React.useState<"all" | "shared" | "exclusive">("all");

  const { data: tables, isPending } = useQuery(
    tablesQueryOptions({ search: search || undefined, floor_id: floorId, status }),
  );
  const { data: floors } = useFloorQuery(floorsQueryOptions());

  const visibleTables = React.useMemo(
    () =>
      (tables ?? []).filter((t) =>
        sharing === "all" ? true : sharing === "shared" ? t.allows_sharing : !t.allows_sharing,
      ),
    [tables, sharing],
  );
  const [inputValue, setInputValue] = React.useState("");
  // Debounce search input
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  if (isPending) {
    return (
      <PageContainer pageTitle="Tables" pageDescription="Outlet — Tables" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Tables"
      pageDescription="Outlet — Tables. Tables belong to floors, have capacity and status for POS seating and KOT routing."
      pageHeaderAction={
        <Link
          href="/dashboard/settings/outlet/tables/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Table
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search tables by number or code..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={floorId ?? "all"}
          onValueChange={(v) => setFloorId(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by floor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Floors</SelectItem>
            {(floors ?? []).map((floor) => (
              <SelectItem key={floor.id} value={floor.id}>
                {floor.name} ({floor.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status ?? "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : (v as TableStatus))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="cleaning">Cleaning</SelectItem>
            <SelectItem value="out_of_service">Out of service</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sharing} onValueChange={(v) => setSharing(v as typeof sharing)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Filter by sharing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="shared">Shared only</SelectItem>
            <SelectItem value="exclusive">Exclusive only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TableList tables={visibleTables} />

      <p className="mt-4 text-xs text-muted-foreground">
        Standard restaurant practice: 2-pax tables for couples, 4-pax for families, 6+ for banquets.
        Status drives POS availability and reservation flow. Sort order controls display sequence on
        floor plan.
      </p>
    </PageContainer>
  );
}

"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { TableList } from "@/features/table/components/table-list";
import { tablesQueryOptions } from "@/features/table/api/queries";
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

  const { data: tables, isPending } = useQuery(
    tablesQueryOptions({ search: search || undefined, floor_id: floorId }),
  );
  const { data: floors } = useFloorQuery(floorsQueryOptions());

  // Debounce search input
  const [inputValue, setInputValue] = React.useState("");
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
          <Icons.add className="mr-2 h-4 w-4" /> Add New
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
      </div>

      <TableList tables={tables ?? []} />

      <p className="mt-4 text-xs text-muted-foreground">
        Standard restaurant practice: 2-pax tables for couples, 4-pax for families, 6+ for banquets.
        Status drives POS availability and reservation flow. Sort order controls display sequence on
        floor plan.
      </p>
    </PageContainer>
  );
}

"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { FloorList } from "@/features/floor/components/floor-list";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";

export default function FloorsPage() {
  const [search, setSearch] = React.useState("");

  const { data: floors, isPending } = useQuery(floorsQueryOptions(search ? { search } : undefined));

  // Debounce search input
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  if (isPending) {
    return (
      <PageContainer pageTitle="Floors" pageDescription="Outlet — Floors" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Floors"
      pageDescription="Outlet — Floors. Manage serving areas: Ground, First, Rooftop, Basement. Each floor groups tables and routes orders."
      pageHeaderAction={
        <Link
          href="/dashboard/settings/outlet/floors/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Search floors by name or code..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <FloorList floors={floors ?? []} />

      <p className="mt-4 text-xs text-muted-foreground">
        Floors organize tables and KOT routing. Sort order controls display priority. Inactive
        floors are hidden from floor selection but retained for history.
      </p>
    </PageContainer>
  );
}

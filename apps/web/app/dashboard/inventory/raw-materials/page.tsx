"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { RawMaterialList } from "@/features/inventory/components/raw-material-list";
import { rawMaterialsQueryOptions } from "@/features/inventory/api/queries";
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

const CATEGORIES = [
  "Vegetables",
  "Grains",
  "Meat",
  "Dairy",
  "Oil",
  "Spices",
  "Beverages",
  "General",
] as const;

export default function RawMaterialsPage() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: materials, isPending } = useQuery(
    rawMaterialsQueryOptions({
      search: search || undefined,
      category: category || undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer
        pageTitle="Raw Materials"
        pageDescription="Inventory — Raw Materials"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Raw Materials"
      pageDescription="Inventory — Ingredients for recipes, stock tracking, low-stock alerts, supplier linkage."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/raw-materials/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search materials by name or SKU..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={category ?? "all"}
          onValueChange={(v) => setCategory(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <RawMaterialList materials={materials ?? []} />
    </PageContainer>
  );
}

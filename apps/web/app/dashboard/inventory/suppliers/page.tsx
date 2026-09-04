"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { SupplierList } from "@/features/inventory/components/supplier-list";
import { suppliersQueryOptions } from "@/features/inventory/api/queries";
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

export default function SuppliersPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: suppliers, isPending } = useQuery(
    suppliersQueryOptions({
      search: search || undefined,
      is_active: status === "active" ? true : status === "inactive" ? false : undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer pageTitle="Suppliers" pageDescription="Inventory — Suppliers" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Suppliers"
      pageDescription="Inventory — Vendors supplying raw materials. Manage contacts, GSTIN, purchase history."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/suppliers/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search suppliers..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={status ?? "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SupplierList suppliers={suppliers ?? []} />
    </PageContainer>
  );
}

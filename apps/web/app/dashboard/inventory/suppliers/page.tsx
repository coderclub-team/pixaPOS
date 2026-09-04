"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { SupplierList } from "@/features/inventory/components/supplier-list";
import { suppliersQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";
import { Show } from "@clerk/nextjs";

export default function SuppliersPage() {
  const [search, setSearch] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: suppliers, isPending } = useQuery(
    suppliersQueryOptions(search ? { search } : undefined),
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
        <Show when={{ permission: "org:suppliers:manage" }} fallback={null}>
          <Link
            href="/dashboard/inventory/suppliers/new"
            className={cn(buttonVariants(), "text-xs md:text-sm")}
          >
            <Icons.add className="mr-2 h-4 w-4" /> Add New
          </Link>
        </Show>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Search suppliers..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <SupplierList suppliers={suppliers ?? []} />
    </PageContainer>
  );
}

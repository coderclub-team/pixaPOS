"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { SupplierAdjustmentList } from "@/features/inventory/components/supplier-adjustment-list";
import { supplierAdjustmentsQueryOptions } from "@/features/inventory/api/queries";
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

export default function SupplierCreditsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [type, setType] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: adjustments, isPending } = useQuery(
    supplierAdjustmentsQueryOptions({
      search: search || undefined,
      status: (status as any) || undefined,
      type: (type as any) || undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer
        pageTitle="Supplier Credits / Debits"
        pageDescription="Vendor credits (CN-SUP) and debits (DN-SUP) — financial only, purchase optional"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Supplier Credits / Debits"
      pageDescription="Credits = vendor owes you (rate diff, shortage, discount, advance); Debits = you owe extra (freight, correction). Draft → Posted → Apply to bills."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/supplier-credits/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Adjustment
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search CN/DN, supplier, reference..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={type ?? "all"} onValueChange={(v) => setType(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status ?? "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SupplierAdjustmentList adjustments={adjustments ?? []} />
    </PageContainer>
  );
}

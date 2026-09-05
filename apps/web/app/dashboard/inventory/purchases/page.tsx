"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { PurchaseList } from "@/features/inventory/components/purchase-list";
import { purchasesQueryOptions } from "@/features/inventory/api/queries";
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

export default function PurchasesPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: purchases, isPending } = useQuery(
    purchasesQueryOptions({
      search: search || undefined,
      payment_status: (status as any) || undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer
        pageTitle="Purchases"
        pageDescription="Inventory — Purchases (Bills)"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Purchases"
      pageDescription="Inventory — Bills when goods received. PO → GRN → Purchase Bill. Stock adds on purchase, not on PO. Supports direct purchase (no PO) and PO-linked."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/purchases/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Purchase
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search purchase #, supplier or PO..."
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
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PurchaseList purchases={purchases ?? []} />
    </PageContainer>
  );
}

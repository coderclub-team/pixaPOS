"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { PurchaseReturnList } from "@/features/inventory/components/purchase-return-list";
import { purchaseReturnsQueryOptions } from "@/features/inventory/api/queries";
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

export default function ReturnsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: returns, isPending } = useQuery(
    purchaseReturnsQueryOptions({
      search: search || undefined,
      status: (status as any) || undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer
        pageTitle="Purchase Returns"
        pageDescription="Returns / Credit Notes — vendor credits (Odoo reverse, Zoho vendor credit)"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Purchase Returns"
      pageDescription="Returns when goods damaged/expired/short. Draft → Approve deducts stock (if Restock) and creates credit of total refund."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/returns/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Return
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search return #, purchase #, supplier..."
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
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PurchaseReturnList returns={returns ?? []} />
    </PageContainer>
  );
}

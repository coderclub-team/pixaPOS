"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { PaymentsList } from "@/features/inventory/components/payments-list";
import { paymentsQueryOptions } from "@/features/inventory/api/queries";
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

export default function PaymentsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const [mode, setMode] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: payments, isPending } = useQuery(
    paymentsQueryOptions({
      search: search || undefined,
      status: status as any,
      payment_mode: mode as any,
    }),
  );
  if (isPending)
    return (
      <PageContainer
        pageTitle="Payments"
        pageDescription="Supplier payments — posted advances & bill payments"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Payments"
      pageDescription="Payments Made — single posted, purchase optional (advance). Cancel reverses purchase paid. Ledger payment entries."
      pageHeaderAction={
        <Link
          href="/dashboard/inventory/payments/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Payment
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search PAY-#, supplier, reference..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={mode ?? "all"} onValueChange={(v) => setMode(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All modes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status ?? "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PaymentsList payments={payments ?? []} />
    </PageContainer>
  );
}

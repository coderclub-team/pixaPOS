"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { CustomerList } from "@/features/customers/components/customer-list";
import { customerKeys, customersQueryOptions } from "@/features/customers/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";
import { ExportButton, ImportDialog } from "@/features/system/components/io-dialog";
import { customerColumns, customerSample, importCustomers } from "@/features/customers/lib/io";

export default function CustomersPage() {
  const [search, setSearch] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");

  const { data: customers, isPending } = useQuery(
    customersQueryOptions({ search: search || undefined }),
  );

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  if (isPending) {
    return (
      <PageContainer pageTitle="Customers" pageDescription="Sales — Customers" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Customers"
      pageDescription="Customer records with addresses for dine-in, delivery and future website orders."
      pageHeaderAction={
        <Link
          href="/dashboard/customers/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New Customer
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search customers by name, phone or email..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <span className="ml-auto flex gap-2">
          <ExportButton filename="customers" rows={customers ?? []} columns={customerColumns} />
          <ImportDialog
            title="Bulk import customers"
            sampleFilename="customers"
            columns={customerColumns}
            sampleRows={customerSample}
            onImport={importCustomers}
            onDone={() => getQueryClient().invalidateQueries({ queryKey: customerKeys.all })}
          />
        </span>
      </div>

      <CustomerList customers={customers ?? []} />
    </PageContainer>
  );
}

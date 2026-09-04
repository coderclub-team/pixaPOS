"use client";
import PageContainer from "@/components/layout/page-container";
import { StockLedger } from "@/features/inventory/components/stock-ledger";
import { stockLedgerQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function StockPage() {
  const { data: entries, isPending } = useQuery(stockLedgerQueryOptions());
  if (isPending)
    return (
      <PageContainer pageTitle="Stock Ledger" pageDescription="Inventory — Stock Ledger" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Stock Ledger"
      pageDescription="Inventory — Full stock transaction history: purchase, waste, adjustment, recipe consumption. Previous → new qty tracking."
    >
      <StockLedger entries={entries ?? []} />
    </PageContainer>
  );
}

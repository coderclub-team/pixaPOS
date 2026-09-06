"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { SupplierLedger } from "@/features/inventory/components/supplier-ledger";
import {
  supplierLedgerQueryOptions,
  supplierOutstandingQueryOptions,
  suppliersQueryOptions,
} from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Card, CardContent } from "@pixa/ui/base-ui/card";

export default function SupplierLedgerPage() {
  const [supplierId, setSupplierId] = React.useState<string | undefined>(undefined);
  const [type, setType] = React.useState<string | undefined>(undefined);
  const [search, setSearch] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: entries, isPending } = useQuery(
    supplierLedgerQueryOptions({
      supplier_id: supplierId,
      type: type as any,
      search: search || undefined,
    }),
  );
  const { data: outstanding } = useQuery(supplierOutstandingQueryOptions());

  const totals = React.useMemo(() => {
    const totalPayable = (outstanding ?? []).reduce((s, o) => s + o.payable, 0);
    const totalOverdue = (outstanding ?? []).reduce((s, o) => s + o.overdue, 0);
    const totalCredit = (outstanding ?? []).reduce((s, o) => s + o.credit_available, 0);
    return {
      totalPayable: Math.round(totalPayable * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
    };
  }, [outstanding]);

  if (isPending)
    return (
      <PageContainer
        pageTitle="Supplier Ledger"
        pageDescription="Global payables — Odoo Journals / Zoho Vendor Statement"
        isLoading
      >
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Supplier Ledger"
      pageDescription="Global ledger — what we owe per supplier. Purchase (+) / Payment (-) / Credit (-) / Debit (+) / Return (-) chronological with running balance. Derived, no stored balance."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Payables</div>
            <div className="font-mono text-lg font-bold">₹{totals.totalPayable.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Overdue</div>
            <div className="font-mono text-lg font-bold text-destructive">
              ₹{totals.totalOverdue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Credits Available</div>
            <div className="font-mono text-lg font-bold text-green-600">
              ₹{totals.totalCredit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search supplier / reference..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={supplierId ?? "all"}
          onValueChange={(v) => setSupplierId(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {(suppliers ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type ?? "all"} onValueChange={(v) => setType(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="return">Return</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(outstanding ?? []).length > 0 && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs">
          <div className="font-medium">Per-Supplier Outstanding</div>
          <div className="mt-1 space-y-1">
            {(outstanding ?? []).map((o) => (
              <div key={o.supplier_id} className="flex flex-wrap justify-between gap-2">
                <span>{o.supplier_name}</span>
                <span className="font-mono">
                  Payable ₹{o.payable.toFixed(2)}{" "}
                  {o.overdue > 0 ? (
                    <span className="text-destructive">• Overdue ₹{o.overdue.toFixed(2)}</span>
                  ) : null}{" "}
                  {o.credit_available > 0 ? (
                    <span className="text-green-600">
                      • Credit ₹{o.credit_available.toFixed(2)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <SupplierLedger entries={entries ?? []} />
      </div>
    </PageContainer>
  );
}

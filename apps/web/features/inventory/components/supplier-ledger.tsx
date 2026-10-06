"use client";
import type { SupplierLedgerEntry } from "../api/types";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import Link from "next/link";
import { SortTh, useSorting } from "@/components/sort-th";
import type { CsvColumn } from "@/features/system/lib/csv";

function typeClass(t: string) {
  if (t === "purchase") return "text-green-600";
  if (t === "payment") return "text-muted-foreground";
  if (t === "credit" || t === "return") return "text-amber-600";
  if (t === "debit") return "text-destructive";
  return "text-muted-foreground";
}

export const supplierLedgerExportColumns: CsvColumn<SupplierLedgerEntry>[] = [
  { key: "created_at", label: "Created At", get: (e) => e.created_at },
  { key: "bill_date", label: "Bill Date", get: (e) => e.bill_date },
  { key: "supplier_name", label: "Supplier", get: (e) => e.supplier_name ?? e.supplier_id },
  { key: "type", label: "Type", get: (e) => e.type },
  {
    key: "reference_number",
    label: "Reference",
    get: (e) => e.reference_number ?? e.reference_id ?? "",
  },
  { key: "reason", label: "Reason", get: (e) => e.reason ?? "" },
  { key: "amount", label: "Amount", get: (e) => `₹${e.amount.toFixed(2)}` },
  { key: "balance_after", label: "Balance", get: (e) => `₹${e.balance_after.toFixed(2)}` },
];

export function SupplierLedger({ entries }: { entries: SupplierLedgerEntry[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<SupplierLedgerEntry>(
    "created_at",
    "desc",
  );
  const rows = sorted(entries, {
    created_at: (e) => e.created_at,
    bill_date: (e) => e.bill_date,
    supplier_name: (e) => e.supplier_name ?? e.supplier_id,
    type: (e) => e.type,
    reference_number: (e) => e.reference_number ?? e.reference_id ?? "",
    reason: (e) => e.reason ?? "",
    amount: (e) => e.amount,
    balance_after: (e) => e.balance_after,
  });

  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No ledger entries — purchases, payments, credits, returns will appear here.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortTh
                  label="Date"
                  column="created_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Supplier"
                  column="supplier_name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Type"
                  column="type"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Reference"
                  column="reference_number"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Reason"
                  column="reason"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortTh
                  label="Amount"
                  column="amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortTh
                  label="Balance"
                  column="balance_after"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">
                  {new Date(e.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs">{e.supplier_name ?? e.supplier_id}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium capitalize ${typeClass(e.type)}`}>
                    {e.type}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {e.reference_id ? (
                    <Link
                      href={
                        e.type === "purchase" || e.type === "payment"
                          ? `/dashboard/inventory/purchases/${e.reference_id}`
                          : e.type === "return"
                            ? `/dashboard/inventory/returns/${e.reference_id}`
                            : `/dashboard/inventory/supplier-credits/${e.reference_id}`
                      }
                      className="underline"
                    >
                      {e.reference_number ?? e.reference_id.slice(0, 8)}
                    </Link>
                  ) : (
                    (e.reference_number ?? "-")
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.reason ?? "-"}</TableCell>
                <TableCell
                  className={`text-right text-xs font-medium ${e.amount > 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {e.amount > 0 ? `+₹${e.amount.toFixed(2)}` : `₹${e.amount.toFixed(2)}`}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-bold">
                  ₹{e.balance_after.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

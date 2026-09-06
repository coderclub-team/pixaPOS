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

function typeClass(t: string) {
  if (t === "purchase") return "text-green-600";
  if (t === "payment") return "text-muted-foreground";
  if (t === "credit" || t === "return") return "text-amber-600";
  if (t === "debit") return "text-destructive";
  return "text-muted-foreground";
}

export function SupplierLedger({ entries }: { entries: SupplierLedgerEntry[] }) {
  if (entries.length === 0)
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
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
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

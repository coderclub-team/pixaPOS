"use client";
import type { StockLedgerEntry } from "../api/types";
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

export function StockLedger({ entries }: { entries: StockLedgerEntry[] }) {
  if (entries.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No stock transactions yet.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const value = e.new_qty * (e.avg_cost_after ?? e.avg_cost_before ?? 0);
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/inventory/raw-materials/${e.material_id}`}
                      className="underline"
                    >
                      {e.material_name ?? e.material_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium capitalize ${e.type === "purchase" ? "text-green-600" : e.type === "waste" ? "text-destructive" : e.type === "purchase_return" ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      {e.type.replaceAll("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right ${e.qty_delta > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {e.qty_delta > 0 ? `+${e.qty_delta}` : e.qty_delta}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.previous_qty} → {e.new_qty}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {e.unit_cost !== undefined ? (
                      <>
                        <div>@₹{e.unit_cost}</div>
                        <div className="text-muted-foreground">₹{e.total_cost}</div>
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {e.avg_cost_before !== undefined ? (
                      <>
                        <div>
                          ₹{e.avg_cost_before} → ₹{e.avg_cost_after}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.reason ?? e.reference_id ?? "-"}{" "}
                    {value > 0 && (
                      <span className="text-muted-foreground">• Val ₹{value.toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(e.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

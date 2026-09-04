"use client";
import type { StockLedgerEntry } from "../api/types";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";

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
              <TableHead>Delta</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Avg</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.material_name ?? e.material_id}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      e.type === "purchase"
                        ? "default"
                        : e.type === "waste"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {e.type}
                  </Badge>
                </TableCell>
                <TableCell className={e.qty_delta > 0 ? "text-green-600" : "text-red-600"}>
                  {e.qty_delta > 0 ? `+${e.qty_delta}` : e.qty_delta}
                </TableCell>
                <TableCell>
                  {e.previous_qty} → {e.new_qty}
                </TableCell>
                <TableCell className="text-xs">
                  {e.unit_cost !== undefined ? (
                    <>
                      <div>@₹{e.unit_cost}</div>
                      <div className="text-muted-foreground">₹{e.total_cost}</div>
                    </>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-xs">
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
                <TableCell className="text-xs">{e.reason ?? e.reference_id ?? "-"}</TableCell>
                <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

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
import { SortTh, useSorting } from "@/components/sort-th";
import type { CsvColumn } from "@/features/system/lib/csv";

export const stockLedgerExportColumns: CsvColumn<StockLedgerEntry>[] = [
  {
    key: "material_name",
    label: "Material",
    get: (e) => e.material_name ?? e.material_id,
  },
  { key: "type", label: "Type", get: (e) => e.type.replaceAll("_", " ") },
  { key: "qty_delta", label: "Qty Delta", get: (e) => e.qty_delta },
  { key: "previous_qty", label: "Previous Qty", get: (e) => e.previous_qty },
  { key: "new_qty", label: "New Qty", get: (e) => e.new_qty },
  {
    key: "unit_cost",
    label: "Unit Cost",
    get: (e) => (e.unit_cost !== undefined ? `₹${e.unit_cost.toFixed(2)}` : ""),
  },
  {
    key: "total_cost",
    label: "Total Cost",
    get: (e) => (e.total_cost !== undefined ? `₹${e.total_cost.toFixed(2)}` : ""),
  },
  {
    key: "avg_cost_before",
    label: "Avg Cost Before",
    get: (e) => (e.avg_cost_before !== undefined ? `₹${e.avg_cost_before.toFixed(2)}` : ""),
  },
  {
    key: "avg_cost_after",
    label: "Avg Cost After",
    get: (e) => (e.avg_cost_after !== undefined ? `₹${e.avg_cost_after.toFixed(2)}` : ""),
  },
  {
    key: "value",
    label: "Stock Value",
    get: (e) => `₹${(e.new_qty * (e.avg_cost_after ?? e.avg_cost_before ?? 0)).toFixed(2)}`,
  },
  { key: "reference_id", label: "Reference", get: (e) => e.reference_id ?? "" },
  { key: "reason", label: "Reason", get: (e) => e.reason ?? "" },
  { key: "created_at", label: "Created At", get: (e) => e.created_at },
];

export function StockLedger({ entries }: { entries: StockLedgerEntry[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<StockLedgerEntry>("created_at", "desc");
  const rows = sorted(entries, {
    material_name: (e) => e.material_name ?? e.material_id,
    type: (e) => e.type,
    qty_delta: (e) => e.qty_delta,
    previous_qty: (e) => e.previous_qty,
    new_qty: (e) => e.new_qty,
    unit_cost: (e) => e.unit_cost ?? 0,
    total_cost: (e) => e.total_cost ?? 0,
    avg_cost_before: (e) => e.avg_cost_before ?? 0,
    avg_cost_after: (e) => e.avg_cost_after ?? 0,
    value: (e) => e.new_qty * (e.avg_cost_after ?? e.avg_cost_before ?? 0),
    reference_id: (e) => e.reference_id ?? "",
    reason: (e) => e.reason ?? "",
    created_at: (e) => e.created_at,
  });

  if (rows.length === 0)
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
              <TableHead>
                <SortTh
                  label="Material"
                  column="material_name"
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
              <TableHead className="text-right">
                <SortTh
                  label="Delta"
                  column="qty_delta"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortTh
                  label="Qty"
                  column="new_qty"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortTh
                  label="Cost"
                  column="total_cost"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortTh
                  label="Avg"
                  column="avg_cost_after"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                  className="ml-auto"
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Reference"
                  column="reference_id"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Date"
                  column="created_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
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

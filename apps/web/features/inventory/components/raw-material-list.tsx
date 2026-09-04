"use client";
import type { RawMaterial } from "../api/types";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { useMutation } from "@tanstack/react-query";
import { deleteRawMaterial } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";

export function RawMaterialList({ materials }: { materials: RawMaterial[] }) {
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRawMaterial(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Raw material deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.package className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No raw materials</p>
            <p className="text-sm text-muted-foreground">
              Add ingredients — e.g., Basmati Rice, Chicken, Oil with stock and supplier.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => {
              const low = m.stock_qty <= m.low_stock_threshold;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{m.sku}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {m.unit} • {m.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{m.category}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={low ? "destructive" : m.is_active ? "default" : "secondary"}>
                      {m.stock_qty} {m.unit} {low ? "(Low)" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium">₹{m.cost_price}</span>
                      <span className="text-muted-foreground">Avg ₹{m.avg_cost}</span>
                      {(() => {
                        const delta = m.avg_cost
                          ? ((m.cost_price - m.avg_cost) / m.avg_cost) * 100
                          : 0;
                        const isUp = delta > 2;
                        const isDown = delta < -2;
                        if (!isUp && !isDown) return null;
                        return (
                          <span className={isUp ? "text-red-600" : "text-green-600"}>
                            {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/dashboard/inventory/raw-materials/${m.id}`}>
                        <Button variant="ghost" size="icon-sm">
                          <Icons.edit className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => confirm(`Delete ${m.name}?`) && deleteMutation.mutate(m.id)}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
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

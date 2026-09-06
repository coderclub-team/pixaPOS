"use client";
import type { RawMaterial } from "../api/types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { useMutation } from "@tanstack/react-query";
import { deleteRawMaterial } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RawMaterialList({ materials }: { materials: RawMaterial[] }) {
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
              <TableHead className="text-right">Valuation</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => (
              <RawMaterialRow key={m.id} m={m} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RawMaterialRow({ m }: { m: RawMaterial }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRawMaterial(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Raw material deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });
  const low = m.stock_qty <= m.low_stock_threshold;
  const stockValue = m.stock_qty * m.avg_cost;
  const delta = m.avg_cost ? ((m.cost_price - m.avg_cost) / m.avg_cost) * 100 : 0;
  const isUp = delta > 2;
  const isDown = delta < -2;
  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete raw material?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {m.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(m.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{m.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{m.sku}</span>
          </div>
          <span className="text-xs text-muted-foreground">{m.unit}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm capitalize text-muted-foreground">{m.category}</span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className={low ? "text-sm font-medium text-destructive" : "text-sm"}>
              {m.stock_qty} {m.unit}
            </span>
            {low && (
              <span
                className="inline-block size-1.5 rounded-full bg-destructive"
                title="Low stock"
              />
            )}
            {!m.is_active && <span className="text-xs text-muted-foreground">• Inactive</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Threshold {m.low_stock_threshold} • Value ₹{stockValue.toFixed(2)}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end text-xs">
            <span className="font-mono font-medium">₹{m.avg_cost.toFixed(2)}</span>
            <span className="text-[11px] text-muted-foreground">
              Last ₹{m.cost_price.toFixed(2)}
            </span>
            {(isUp || isDown) && (
              <span
                className={isUp ? "text-[11px] text-destructive" : "text-[11px] text-green-600"}
              >
                {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
              <span className="sr-only">Open menu</span>
              <Icons.ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/inventory/raw-materials/${m.id}`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> Update
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                  <Icons.trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </>
  );
}

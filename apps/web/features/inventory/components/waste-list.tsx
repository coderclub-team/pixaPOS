"use client";
import { useState } from "react";
import type { WasteLog } from "../api/types";
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
import { SortTh, useSorting } from "@/components/sort-th";
import type { CsvColumn } from "@/features/system/lib/csv";

export const wasteExportColumns: CsvColumn<WasteLog>[] = [
  {
    key: "material",
    label: "Material / Recipe",
    get: (w) => w.material_name ?? w.material_id ?? w.recipe_name ?? "",
  },
  { key: "qty", label: "Qty", get: (w) => `${w.qty} ${w.unit}` },
  {
    key: "reason",
    label: "Reason",
    get: (w) => w.reason.replaceAll("_", " "),
  },
  { key: "order_number", label: "Order #", get: (w) => w.order_number ?? "" },
  { key: "recipe_name", label: "Recipe", get: (w) => w.recipe_name ?? "" },
  {
    key: "variant_name",
    label: "Variant",
    get: (w) => w.variant_name ?? "",
  },
  { key: "cost_loss", label: "Cost Loss", get: (w) => `₹${w.cost_loss.toFixed(2)}` },
  { key: "created_at", label: "Created At", get: (w) => w.created_at },
];

export function WasteList({ logs }: { logs: WasteLog[] }) {
  const { sortKey, sortDir, toggle, sorted } = useSorting<WasteLog>("created_at", "desc");
  const rows = sorted(logs, {
    material: (w) => w.material_name ?? w.material_id ?? w.recipe_name ?? "",
    qty: (w) => w.qty,
    reason: (w) => w.reason,
    order_number: (w) => w.order_number ?? "",
    recipe_name: (w) => w.recipe_name ?? "",
    variant_name: (w) => w.variant_name ?? "",
    cost_loss: (w) => w.cost_loss,
    created_at: (w) => w.created_at,
  });

  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No waste logs — log spoilage, expired, trimming to track cost loss.
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
                  column="material"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Qty"
                  column="qty"
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
              <TableHead>
                <SortTh
                  label="Order"
                  column="order_number"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggle}
                />
              </TableHead>
              <TableHead>
                <SortTh
                  label="Cost Loss"
                  column="cost_loss"
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => (
              <WasteRow key={w.id} log={w} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WasteRow({ log: w }: { log: WasteLog }) {
  const [viewOpen, setViewOpen] = useState(false);
  return (
    <>
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {w.material_name ?? w.material_id ?? w.recipe_name ?? "Waste"}
            </DialogTitle>
            <DialogDescription>
              {w.qty} {w.unit} • {w.reason.replace("_", " ")} •{" "}
              {new Date(w.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {w.photo_url && (
              <img
                src={w.photo_url}
                alt="waste evidence"
                className="h-40 w-full rounded border object-cover"
              />
            )}
            {w.order_number && <p>Order: {w.order_number}</p>}
            {w.recipe_name && (
              <p>
                Recipe: {w.recipe_name}
                {w.variant_name ? ` (${w.variant_name})` : ""}
              </p>
            )}
            {w.notes && <p className="text-muted-foreground">Notes: {w.notes}</p>}
            <p className="font-mono font-medium">Cost loss ₹{w.cost_loss}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            {w.photo_url && (
              <img src={w.photo_url} alt="" className="h-6 w-6 rounded border object-cover" />
            )}
            <span>{w.material_name ?? w.material_id ?? w.recipe_name ?? "-"}</span>
          </div>
        </TableCell>
        <TableCell>
          {w.qty} {w.unit}
        </TableCell>
        <TableCell>
          <span className="text-xs capitalize text-muted-foreground">
            {w.reason.replace("_", " ")}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {w.order_number ?? (w.order_id ? w.order_id.slice(0, 8) : "—")}
        </TableCell>
        <TableCell>₹{w.cost_loss}</TableCell>
        <TableCell className="text-xs">{new Date(w.created_at).toLocaleDateString()}</TableCell>
        <TableCell className="text-right">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
              <Icons.ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setViewOpen(true)}>
                  <Icons.edit className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </>
  );
}

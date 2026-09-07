"use client";
import type { MenuItem } from "../api/types";
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
import { deleteMenuItem } from "../api/service";
import { menuKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function MenuList({ items }: { items: MenuItem[] }) {
  if (items.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.pizza className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No menu items</p>
            <p className="text-sm text-muted-foreground">
              Add dishes — e.g., Biryani, Cold Coffee with variants Small/Large/250ml.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dish</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m) => (
              <MenuRow key={m.id} item={m} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteMenuItem(item.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Menu item deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const priceRange = (() => {
    const prices = item.variants.map((v) => v.selling_price);
    const min = Math.min(...prices),
      max = Math.max(...prices);
    return min === max ? `₹${min}` : `₹${min} – ₹${max}`;
  })();
  const visibleVariants = item.variants.slice(0, 3);
  const remaining = item.variants.length - visibleVariants.length;
  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {item.name}?</DialogTitle>
            <DialogDescription>Are you sure? Variants will be removed.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block size-1.5 rounded-full ${item.veg_type === "veg" ? "bg-green-600" : item.veg_type === "nonveg" ? "bg-destructive" : "bg-amber-500"}`}
              title={item.veg_type}
            />
            <span className="font-medium">{item.name}</span>
            {!item.is_active && <span className="text-xs text-muted-foreground">• Inactive</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.variants
              .map((v) => v.sku)
              .slice(0, 2)
              .join(", ")}
            {item.variants.length > 2 ? " …" : ""}
          </div>
        </TableCell>
        <TableCell className="text-sm capitalize text-muted-foreground">
          {item.category_name ?? "-"}
        </TableCell>
        <TableCell
          className="text-xs"
          title={item.variants.map((v) => `${v.name} ${v.sku} ₹${v.selling_price}`).join(", ")}
        >
          {visibleVariants
            .map(
              (v) =>
                `${v.name}${v.label ? ` (${v.label})` : v.qty ? ` ${v.qty}${v.unit ?? ""}` : ""}${v.is_default ? " ★" : ""}`,
            )
            .join(", ")}
          {remaining > 0 && <span className="text-muted-foreground"> +{remaining} more</span>}
        </TableCell>
        <TableCell
          className="text-right font-mono text-xs font-medium"
          title={item.variants.map((v) => `${v.name}: ₹${v.selling_price}`).join(" | ")}
        >
          {priceRange}
        </TableCell>
        <TableCell className="text-xs capitalize text-muted-foreground">
          {item.available_channels.slice(0, 3).join(", ")}
          {item.available_channels.length > 3 ? ` +${item.available_channels.length - 3}` : ""}
        </TableCell>
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
                <DropdownMenuItem onClick={() => router.push(`/dashboard/menu/items/${item.id}`)}>
                  <Icons.edit className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/menu/items/${item.id}/edit`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> Update
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                  <Icons.trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={`/dashboard/menu/items/${item.id}`} className="sr-only">
            View
          </Link>
        </TableCell>
      </TableRow>
    </>
  );
}

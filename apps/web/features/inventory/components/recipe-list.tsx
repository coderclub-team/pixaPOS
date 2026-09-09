"use client";
import type { Recipe } from "../api/types";
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
import { deleteRecipe } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No recipes — create BOM for menu costing.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipe</TableHead>
              <TableHead>Ingredients</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Cost/Serve</TableHead>
              <TableHead>Selling</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((r) => (
              <RecipeRow key={r.id} recipe={r} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecipeRow({ recipe: r }: { recipe: Recipe }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const margin = r.selling_price
    ? Math.round(((r.selling_price - r.cost_per_serve) / r.selling_price) * 100)
    : 0;
  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {r.name}?</DialogTitle>
            <DialogDescription>
              Are you sure? Ingredients and method steps will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => del.mutate(r.id)} disabled={del.isPending}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            Yields {r.yields}
            {(r as any).yield_unit ? ` ${(r as any).yield_unit}` : ""} • {r.ingredients.length}{" "}
            items
            {!r.is_active && " • Inactive"}
          </div>
        </TableCell>
        <TableCell
          className="max-w-[280px] truncate text-xs"
          title={r.ingredients.map((ing) => `${ing.material_name} ${ing.qty}${ing.unit}`).join(", ")}
        >
          {r.ingredients.map((ing) => `${ing.material_name} ${ing.qty}${ing.unit}`).join(", ")}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {(r.steps ?? []).length > 0 ? `${r.steps.length} steps` : "—"}
        </TableCell>
        <TableCell>₹{r.cost_per_serve}</TableCell>
        <TableCell>{r.selling_price ? `₹${r.selling_price}` : "-"}</TableCell>
        <TableCell>
          <span
            className={`text-xs font-medium ${margin > 40 ? "text-green-600" : "text-muted-foreground"}`}
          >
            {margin}%
          </span>
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
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/inventory/recipes/${r.id}/card`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" /> View card
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/inventory/recipes/${r.id}/edit`)}
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

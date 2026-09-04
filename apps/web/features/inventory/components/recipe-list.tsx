"use client";
import type { Recipe } from "../api/types";
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
import { deleteRecipe } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";
import { Show } from "@clerk/nextjs";

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
  const del = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
              <TableHead>Cost/Serve</TableHead>
              <TableHead>Selling</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((r) => {
              const margin = r.selling_price
                ? Math.round(((r.selling_price - r.cost_per_serve) / r.selling_price) * 100)
                : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Yields {r.yields} • {r.ingredients.length} items
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.ingredients
                      .map((ing) => `${ing.material_name} ${ing.qty}${ing.unit}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell>₹{r.cost_per_serve}</TableCell>
                  <TableCell>{r.selling_price ? `₹${r.selling_price}` : "-"}</TableCell>
                  <TableCell>
                    <Badge variant={margin > 40 ? "default" : "secondary"}>{margin}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Show when={{ permission: "org:recipes:manage" }} fallback={null}>
                        <Link href={`/dashboard/inventory/recipes/${r.id}`}>
                          <Button variant="ghost" size="icon-sm">
                            <Icons.edit className="size-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)}
                        >
                          <Icons.trash className="size-4" />
                        </Button>
                      </Show>
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

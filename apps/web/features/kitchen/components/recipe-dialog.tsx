"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { menuItemQueryOptions } from "@/features/menu/api/queries";
import { recipeQueryOptions } from "@/features/inventory/api/queries";

/**
 * Recipe reader for KDS lines: resolves order line → menu variant →
 * recipe lazily on open (no N+1 on the board, no navigation away from the
 * tickets). Shows yield/times, ingredients and method; graceful empty
 * state when nothing is linked.
 */
export function RecipeDialogButton({
  orderId,
  orderLineId,
  itemName,
}: {
  orderId: string;
  orderLineId: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-9 w-9 shrink-0"
        onClick={() => setOpen(true)}
        title={`View recipe — ${itemName}`}
        aria-label={`View recipe for ${itemName}`}
      >
        <Icons.clipboardList className="size-4" />
      </Button>
      {open && (
        <RecipeDialog
          orderId={orderId}
          orderLineId={orderLineId}
          itemName={itemName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RecipeDialog({
  orderId,
  orderLineId,
  itemName,
  onClose,
}: {
  orderId: string;
  orderLineId: string;
  itemName: string;
  onClose: () => void;
}) {
  const { data: order } = useQuery({ ...orderQueryOptions(orderId), enabled: !!orderId });
  const line = order?.items.find((i) => i.id === orderLineId);
  const menuItemId = line?.menu_item_id;
  const { data: menuItem } = useQuery({
    ...menuItemQueryOptions(menuItemId ?? ""),
    enabled: !!menuItemId,
  });
  const variant =
    menuItem?.variants.find((v) => v.id === (line?.variant_id ?? undefined)) ??
    menuItem?.variants[0];
  const recipeId = variant?.recipe_id;
  const { data: recipe, isPending: recipePending } = useQuery({
    ...recipeQueryOptions(recipeId ?? ""),
    enabled: !!recipeId,
  });
  // NOTE: a disabled query reports isPending — only treat it as loading
  // when a recipe id is actually being resolved.
  const loadingRecipe = !!recipeId && recipePending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{recipe?.name ?? itemName}</DialogTitle>
          <DialogDescription>
            {recipe
              ? `Serves ${recipe.yields}${recipe.yield_unit ? ` ${recipe.yield_unit}` : ""}`
              : "Recipe card"}
          </DialogDescription>
        </DialogHeader>
        {loadingRecipe ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading recipe…</p>
        ) : !recipe ? (
          <div className="mx-auto flex max-w-xs flex-col items-center gap-2 py-8 text-center">
            <div className="rounded-full border border-dashed p-3">
              <Icons.clipboardList className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No recipe linked</p>
            <p className="text-sm text-muted-foreground">
              {itemName} has no recipe card yet — link one from the menu item to see ingredients and
              method here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(recipe.prep_time_min != null || recipe.cook_time_min != null) && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {recipe.prep_time_min != null && <span>Prep · {recipe.prep_time_min} min</span>}
                {recipe.cook_time_min != null && <span>Cook · {recipe.cook_time_min} min</span>}
              </p>
            )}
            {recipe.ingredients.length > 0 && (
              <section aria-label="Ingredients" className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">Ingredients</p>
                <ul className="divide-y rounded-xl border">
                  {recipe.ingredients.map((ing) => (
                    <li
                      key={ing.material_id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {ing.material_name ?? ing.material_id}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {ing.qty} {ing.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {recipe.steps.length > 0 && (
              <section aria-label="Method" className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">Method</p>
                <ol className="space-y-2">
                  {[...recipe.steps]
                    .sort((a, b) => a.step_no - b.step_no)
                    .map((s) => (
                      <li key={s.id} className="flex gap-2.5 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {s.step_no}
                        </span>
                        <span className="min-w-0 flex-1">
                          {s.instruction}
                          {(s.duration_min != null || s.temperature_c != null) && (
                            <span className="block text-xs text-muted-foreground">
                              {[
                                s.duration_min != null ? `${s.duration_min} min` : null,
                                s.temperature_c != null ? `${s.temperature_c}°C` : null,
                                s.heat_level ?? null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                </ol>
              </section>
            )}
            {(recipe.plating_notes || recipe.garnish || recipe.serving_vessel) && (
              <section aria-label="Plating" className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">Plating</p>
                <div className="space-y-1 rounded-xl border px-3 py-2 text-sm">
                  {recipe.serving_vessel && (
                    <p>
                      <span className="text-muted-foreground">Vessel · </span>
                      {recipe.serving_vessel}
                    </p>
                  )}
                  {recipe.garnish && (
                    <p>
                      <span className="text-muted-foreground">Garnish · </span>
                      {recipe.garnish}
                    </p>
                  )}
                  {recipe.plating_notes && <p>{recipe.plating_notes}</p>}
                </div>
              </section>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose} className="min-h-11">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

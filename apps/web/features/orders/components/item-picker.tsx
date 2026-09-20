"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { addOrderItem, removeDraftItem, updateDraftItemQty } from "@/features/orders/api/service";
import { addAndFireItem, fireKOT } from "@/features/kitchen/api/service";
import { kitchenKeys } from "@/features/kitchen/api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { useFlyToKot } from "./use-fly-to-kot";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getModifiers } from "@/features/menu/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import type { MenuItem } from "@/features/menu/api/types";
import type { OrderItemSnapshot } from "@/features/orders/api/types";

/** Default configuration a quick tap stages: default (or first) variant, no add-ons. */
function defaultVariantOf(item: MenuItem) {
  const variants = item.variants ?? [];
  return variants.find((v) => v.is_default) ?? variants[0];
}

/** Draft lines are keyed by full configuration so counters merge, not split. */
function isDefaultConfigLine(item: MenuItem, line: OrderItemSnapshot): boolean {
  const dv = defaultVariantOf(item);
  return (
    !line.kot_id &&
    line.menu_item_id === item.id &&
    (line.variant_id ?? undefined) === dv?.id &&
    (line.modifiers?.length ?? 0) === 0 &&
    !line.instructions
  );
}

/**
 * Reusable menu picker: search + category rail + grid + variant/add-on dialog.
 * Adds always land as unfired draft lines collected in the tray; nothing
 * reaches the kitchen until Fire to kitchen. With stayOpen, the picker
 * remains for rapid multi-add and shows a fire footer (draft count + Fire to
 * kitchen + Done) instead of closing per add.
 */
export default function ItemPicker({
  orderId,
  onAdded,
  autoFire,
  stayOpen,
  onClose,
}: {
  orderId: string;
  onAdded?: () => void;
  autoFire?: boolean;
  stayOpen?: boolean;
  onClose?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<MenuItem | null>(null);
  const { fly, ghostNode } = useFlyToKot();
  // Source rect + label captured at tap time for the fly-to-KOT ghost.
  const pendingFly = useRef<{
    rect: { x: number; y: number; width: number };
    label: string;
  } | null>(null);
  const { data: order } = useQuery({ ...orderQueryOptions(orderId), enabled: !!stayOpen });

  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId ?? undefined,
      is_active: true,
    }),
  );

  const addMut = useMutation({
    mutationFn: (v: {
      menu_item_id: string;
      variant_id?: string;
      modifier_ids?: string[];
      qty: number;
      instructions?: string;
    }): Promise<unknown> => (autoFire ? addAndFireItem(orderId, v) : addOrderItem(orderId, v)),
    onSuccess: (res: unknown) => {
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
      if (autoFire) qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
      setPicked(null);
      const flyFrom = pendingFly.current;
      pendingFly.current = null;
      if (flyFrom) fly(flyFrom.rect, flyFrom.label);
      toast.success(
        autoFire && typeof res === "object" && res !== null && "kot_number" in res
          ? `Sent to kitchen — KOT #${(res as { kot_number: number }).kot_number}`
          : "Added to draft KOT",
      );
      if (!stayOpen) onAdded?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fireMut = useMutation({
    mutationFn: () => fireKOT(orderId),
    onSuccess: (kot) => {
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
      toast.success(`KOT #${kot.kot_number} fired to kitchen`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draftCount = order?.items.filter((i) => !i.kot_id).length ?? 0;
  const draftLines = useMemo(() => (order?.items ?? []).filter((i) => !i.kot_id), [order?.items]);

  const invalidateOrder = () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
  };

  const qtyMut = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number }) =>
      updateDraftItemQty(orderId, lineId, qty),
    onSuccess: invalidateOrder,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (lineId: string) => removeDraftItem(orderId, lineId),
    onSuccess: invalidateOrder,
    onError: (e: Error) => toast.error(e.message),
  });

  /** Quick-add one unit of the default configuration, merging into its line. */
  const quickAdd = (item: MenuItem) => {
    const existing = draftLines.find((l) => isDefaultConfigLine(item, l));
    if (existing) {
      qtyMut.mutate({ lineId: existing.id, qty: existing.qty + 1 });
      return;
    }
    const dv = defaultVariantOf(item);
    addMut.mutate({
      menu_item_id: item.id,
      variant_id: dv?.id,
      modifier_ids: [],
      qty: 1,
    });
  };

  /** Step the default-configuration line by delta; vanishes at zero. */
  const stepDefault = (item: MenuItem, delta: number) => {
    const existing = draftLines.find((l) => isDefaultConfigLine(item, l));
    if (!existing) {
      if (delta > 0) quickAdd(item);
      return;
    }
    const next = existing.qty + delta;
    if (next <= 0) removeMut.mutate(existing.id);
    else qtyMut.mutate({ lineId: existing.id, qty: next });
  };

  const draftQtyFor = (item: MenuItem) =>
    draftLines.filter((l) => isDefaultConfigLine(item, l)).reduce((s, l) => s + l.qty, 0);

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search menu… (slice of 50, type to refine)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={categoryId == null ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryId(null)}
          >
            All
          </Button>
          {activeCategories.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-1 mb-3 rounded-xl border bg-background/95 px-2 py-2 backdrop-blur-sm">
        {draftLines.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Nothing staged yet — tap a card or use its counter. Fire to kitchen sends it all.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="px-1 text-xs font-medium uppercase text-muted-foreground">
              Staged · {draftLines.reduce((s, l) => s + l.qty, 0)}×
              {draftLines.length > 1 && (
                <button
                  type="button"
                  className="ml-2 normal-case underline underline-offset-2 hover:text-destructive"
                  onClick={() => {
                    for (const l of draftLines) removeMut.mutate(l.id);
                  }}
                >
                  Clear all
                </button>
              )}
            </p>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {draftLines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {l.qty}× {l.item_name_snapshot}
                    {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
                    {l.modifiers?.length
                      ? ` +${l.modifiers.map((m) => m.name_snapshot).join(", ")}`
                      : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={qtyMut.isPending || removeMut.isPending}
                      onClick={() =>
                        l.qty <= 1
                          ? removeMut.mutate(l.id)
                          : qtyMut.mutate({ lineId: l.id, qty: l.qty - 1 })
                      }
                      aria-label={`Decrease ${l.item_name_snapshot}`}
                    >
                      <Icons.minus className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={qtyMut.isPending}
                      onClick={() => qtyMut.mutate({ lineId: l.id, qty: l.qty + 1 })}
                      aria-label={`Increase ${l.item_name_snapshot}`}
                    >
                      <Icons.add className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={removeMut.isPending}
                      onClick={() => removeMut.mutate(l.id)}
                      aria-label={`Remove ${l.item_name_snapshot}`}
                    >
                      <Icons.trash className="size-3.5" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading menu…</p>
      ) : !items?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No menu items match. Try another search or category.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.slice(0, 50).map((item) => {
            const staged = draftQtyFor(item);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.name} — tap to add, staged ${staged}`}
                onClick={(e) => {
                  pendingFly.current = {
                    rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                    label: item.name,
                  };
                  quickAdd(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    quickAdd(item);
                  }
                }}
                className="rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
              >
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      item.veg_type === "veg" ? "bg-green-600" : "bg-red-600",
                    )}
                  />
                  {item.category_name}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatINR(
                    toPaise(
                      ((item.variants ?? []).find((v) => v.is_default) ?? (item.variants ?? [])[0])
                        ?.selling_price ?? 0,
                    ),
                  )}
                </p>
                <div
                  className="mt-2 flex items-center justify-between gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                      staged > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                    aria-live="polite"
                  >
                    {staged > 0 ? `${staged}× staged` : "Not staged"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:h-9 max-lg:w-9"
                      disabled={staged <= 0 || qtyMut.isPending || removeMut.isPending}
                      onClick={() => stepDefault(item, -1)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      <Icons.minus className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:h-9 max-lg:w-9"
                      disabled={addMut.isPending || qtyMut.isPending}
                      onClick={() => stepDefault(item, 1)}
                      aria-label={`Add one ${item.name}`}
                    >
                      <Icons.add className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="max-lg:h-9 max-lg:w-9"
                      onClick={(e) => {
                        pendingFly.current = null;
                        setPicked(item);
                      }}
                      title="Customize — variants, add-ons, instructions"
                      aria-label={`Customize ${item.name}`}
                    >
                      <Icons.edit className="size-3.5" />
                    </Button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {items && items.length > 50 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing first 50 of {items.length} — refine your search.
        </p>
      )}

      {picked && (
        <PickItemDialog
          item={picked}
          pending={addMut.isPending}
          onClose={() => setPicked(null)}
          onAdd={(v) => addMut.mutate({ menu_item_id: picked.id, ...v })}
        />
      )}

      {stayOpen && (
        <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t bg-background/95 pt-3 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            {draftCount > 0
              ? `${draftCount} item${draftCount === 1 ? "" : "s"} in draft`
              : "No draft items"}
          </p>
          <div className="ml-auto flex gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            )}
            <Button
              disabled={fireMut.isPending || draftCount === 0}
              onClick={() => fireMut.mutate()}
            >
              {fireMut.isPending ? "Firing…" : "Fire to kitchen"}
            </Button>
          </div>
        </div>
      )}
      {ghostNode}
    </div>
  );
}

function PickItemDialog({
  item,
  pending,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  pending: boolean;
  onClose: () => void;
  onAdd: (v: {
    variant_id?: string;
    modifier_ids?: string[];
    qty: number;
    instructions?: string;
  }) => void;
}) {
  // variants is optional on some rows (older seeds, form-created items) —
  // never let a missing array crash the dialog.
  const variants = item.variants ?? [];
  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];
  const [variantId, setVariantId] = useState<string | undefined>(defaultVariant?.id);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [instructions, setInstructions] = useState("");
  const { data: modifiers } = useQuery({
    queryKey: ["menu", "modifiers", ...(item.modifier_group_ids ?? [])],
    queryFn: async () => {
      const all: { id: string; name: string; price: number }[] = [];
      for (const gid of item.modifier_group_ids ?? []) {
        all.push(...(await getModifiers(gid)));
      }
      return all;
    },
    enabled: (item.modifier_group_ids?.length ?? 0) > 0,
  });

  const toggleModifier = (id: string) =>
    setModifierIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {item.category_name} · {item.veg_type === "veg" ? "Veg" : "Non-veg"}
          </DialogDescription>
        </DialogHeader>
        {item.product_type === "variant" && variants.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Variant</Label>
            <div className="flex flex-wrap gap-2">
              {variants
                .filter((v) => v.is_active)
                .map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    variant={variantId === v.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVariantId(v.id)}
                  >
                    {v.name} · {formatINR(toPaise(v.selling_price))}
                  </Button>
                ))}
            </div>
          </div>
        )}
        {(modifiers?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Add-ons</Label>
            <div className="flex flex-wrap gap-2">
              {modifiers!.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant={modifierIds.includes(m.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleModifier(m.id)}
                >
                  {m.name} · +{formatINR(toPaise(m.price))}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Instructions (optional)</Label>
          <Input
            placeholder="No onion, extra spicy…"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              className="max-lg:h-10 max-lg:w-10"
              disabled={qty <= 1}
              onClick={() => setQty(qty - 1)}
              aria-label="Decrease quantity"
            >
              <Icons.minus className="size-4" />
            </Button>
            <span className="w-8 text-center font-medium">{qty}</span>
            <Button
              variant="outline"
              size="icon-sm"
              className="max-lg:h-10 max-lg:w-10"
              disabled={qty >= 50}
              onClick={() => setQty(qty + 1)}
              aria-label="Increase quantity"
            >
              <Icons.add className="size-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                onAdd({
                  variant_id: variantId,
                  modifier_ids: modifierIds,
                  qty,
                  instructions: instructions.trim() || undefined,
                })
              }
            >
              {pending ? "Adding…" : `Add ${qty}×`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

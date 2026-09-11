"use client";

import { useMemo, useState } from "react";
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
import { orderKeys } from "@/features/orders/api/queries";
import { addOrderItem } from "@/features/orders/api/service";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getModifiers } from "@/features/menu/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import type { MenuItem } from "@/features/menu/api/types";

/**
 * Reusable menu picker: search + category rail + grid + variant/add-on dialog.
 * Used by the full add-items page and embedded in the order-terminal dialog.
 */
export default function ItemPicker({ orderId, onAdded }: { orderId: string; onAdded?: () => void }) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<MenuItem | null>(null);

  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId ?? undefined,
      is_active: true,
    }),
  );

  const addMut = useMutation({
    mutationFn: (v: { menu_item_id: string; variant_id?: string; modifier_ids?: string[]; qty: number; instructions?: string }) =>
      addOrderItem(orderId, v),
    onSuccess: () => {
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      setPicked(null);
      toast.success("Added to draft KOT");
      onAdded?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          {items.slice(0, 50).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPicked(item)}
              className="rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary"
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
                {formatINR(toPaise((item.variants.find((v) => v.is_default) ?? item.variants[0])?.selling_price ?? 0))}
              </p>
            </button>
          ))}
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
  onAdd: (v: { variant_id?: string; modifier_ids?: string[]; qty: number; instructions?: string }) => void;
}) {
  const defaultVariant = item.variants.find((v) => v.is_default) ?? item.variants[0];
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
        {item.product_type === "variant" && item.variants.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Variant</Label>
            <div className="flex flex-wrap gap-2">
              {item.variants
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
            <Button variant="outline" size="icon-sm" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>
              <Icons.minus className="size-4" />
            </Button>
            <span className="w-8 text-center font-medium">{qty}</span>
            <Button variant="outline" size="icon-sm" disabled={qty >= 50} onClick={() => setQty(qty + 1)}>
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

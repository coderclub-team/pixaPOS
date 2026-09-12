"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
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
import { addManyAndFire } from "@/features/kitchen/api/service";
import { kitchenKeys } from "@/features/kitchen/api/queries";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getModifiers } from "@/features/menu/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import type { MenuItem } from "@/features/menu/api/types";

type Pick = {
  key: string;
  menu_item_id: string;
  name: string;
  variant_id?: string;
  variant_name?: string;
  modifier_ids: string[];
  modifier_names: string[];
  qty: number;
  instructions?: string;
};

/**
 * Searchable row-list item picker. Every row carries a qty counter; tapping
 * a row expands variant / add-on / instruction config. Footer fires the
 * batch — the whole batch fires as ONE KOT via addManyAndFire.
 */
export default function KotItemDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [draftConfig, setDraftConfig] = useState<{
    variant_id?: string;
    modifier_ids: string[];
    modifier_names: string[];
    instructions: string;
  }>({ modifier_ids: [], modifier_names: [], instructions: "" });

  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId ?? undefined,
      is_active: true,
    }),
  );

  const fireMut = useMutation({
    mutationFn: (list: Pick[]) =>
      addManyAndFire(
        orderId,
        list.map((p) => ({
          menu_item_id: p.menu_item_id,
          variant_id: p.variant_id,
          modifier_ids: p.modifier_ids,
          qty: p.qty,
          instructions: p.instructions,
        })),
        undefined,
      ),
    onSuccess: (kot) => {
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: kitchenKeys.byOrder(orderId) });
      setPicks({});
      setExpandedId(null);
      toast.success(`Sent to kitchen — KOT #${kot.kot_number}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );
  const pickList = Object.values(picks);
  const totalQty = pickList.reduce((s, p) => s + p.qty, 0);

  const bump = (item: MenuItem, delta: number) => {
    setPicks((prev) => {
      const cur = prev[item.id];
      const qty = (cur?.qty ?? 0) + delta;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      const variant = item.variants.find((v) => v.is_default) ?? item.variants[0];
      return {
        ...prev,
        [item.id]: {
          key: item.id,
          menu_item_id: item.id,
          name: item.name,
          variant_id: cur?.variant_id ?? variant?.id,
          variant_name: cur?.variant_name ?? (item.product_type === "variant" ? variant?.name : undefined),
          modifier_ids: cur?.modifier_ids ?? [],
          modifier_names: cur?.modifier_names ?? [],
          qty,
        },
      };
    });
  };

  const openRow = (item: MenuItem) => {
    const cur = picks[item.id];
    setDraftConfig({
      variant_id: cur?.variant_id ?? (item.variants.find((v) => v.is_default) ?? item.variants[0])?.id,
      modifier_ids: cur?.modifier_ids ?? [],
      modifier_names: cur?.modifier_names ?? [],
      instructions: cur?.instructions ?? "",
    });
    setExpandedId(expandedId === item.id ? null : item.id);
  };

  const applyRowConfig = (item: MenuItem) => {
    setPicks((prev) => {
      const cur = prev[item.id];
      if (!cur) return prev;
      const variant = item.variants.find((v) => v.id === draftConfig.variant_id);
      return {
        ...prev,
        [item.id]: {
          ...cur,
          variant_id: draftConfig.variant_id,
          variant_name: item.product_type === "variant" ? variant?.name : undefined,
          modifier_ids: draftConfig.modifier_ids,
          modifier_names: draftConfig.modifier_names,
          instructions: draftConfig.instructions.trim() || undefined,
        },
      };
    });
    setExpandedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add items</DialogTitle>
          <DialogDescription>
            Search, set qty per row, expand a row for variants and add-ons. Firing creates a new KOT per item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            No menu items match. Try another search or category.
          </p>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 50).map((item) => {
              const pick = picks[item.id];
              const expanded = expandedId === item.id;
              const price = (item.variants.find((v) => v.is_default) ?? item.variants[0])?.selling_price ?? 0;
              return (
                <div key={item.id} className="rounded-lg border">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <button
                      type="button"
                      onClick={() => openRow(item)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          item.veg_type === "veg" ? "bg-green-600" : "bg-red-600",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.category_name} · {formatINR(toPaise(price))}
                          {pick && pick.modifier_names.length > 0 ? ` · +${pick.modifier_names.join(", ")}` : ""}
                          {pick?.variant_name ? ` · ${pick.variant_name}` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        aria-label={`Remove one ${item.name}`}
                        disabled={!pick}
                        onClick={() => bump(item, -1)}
                      >
                        <Icons.minus className="size-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{pick?.qty ?? 0}</span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => bump(item, 1)}
                      >
                        <Icons.add className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <RowConfig
                      item={item}
                      draft={draftConfig}
                      onChange={setDraftConfig}
                      onApply={() => applyRowConfig(item)}
                      onCancel={() => setExpandedId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {items && items.length > 50 && (
          <p className="text-xs text-muted-foreground">
            Showing first 50 of {items.length} — refine your search.
          </p>
        )}

        <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background/95 pt-3 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            {totalQty > 0 ? `${totalQty} item${totalQty === 1 ? "" : "s"} picked` : "Nothing picked yet"}
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={fireMut.isPending || pickList.length === 0}
              onClick={() => fireMut.mutate(pickList)}
            >
              {fireMut.isPending ? "Firing…" : "Fire to kitchen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RowConfig({
  item,
  draft,
  onChange,
  onApply,
  onCancel,
}: {
  item: MenuItem;
  draft: { variant_id?: string; modifier_ids: string[]; modifier_names: string[]; instructions: string };
  onChange: (d: { variant_id?: string; modifier_ids: string[]; modifier_names: string[]; instructions: string }) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
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

  const toggleModifier = (id: string, name: string) => {
    const has = draft.modifier_ids.includes(id);
    onChange({
      ...draft,
      modifier_ids: has
        ? draft.modifier_ids.filter((m) => m !== id)
        : [...draft.modifier_ids, id],
      modifier_names: has
        ? draft.modifier_names.filter((n) => n !== name)
        : [...draft.modifier_names, name],
    });
  };

  return (
    <div className="space-y-2 border-t px-2 py-2">
      {item.product_type === "variant" && item.variants.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Variant</Label>
          <div className="flex flex-wrap gap-1.5">
            {item.variants
              .filter((v) => v.is_active)
              .map((v) => (
                <Button
                  key={v.id}
                  type="button"
                  variant={draft.variant_id === v.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange({ ...draft, variant_id: v.id })}
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
          <div className="flex flex-wrap gap-1.5">
            {modifiers!.map((m) => (
              <Button
                key={m.id}
                type="button"
                variant={draft.modifier_ids.includes(m.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleModifier(m.id, m.name)}
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
          value={draft.instructions}
          onChange={(e) => onChange({ ...draft, instructions: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
        <Button size="sm" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

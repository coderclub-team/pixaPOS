"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";
import type { MenuCategory } from "@/features/menu/api/types";

/** Active-item counts per category (shared React Query cache — one fetch
 * no matter how many callers). Powers the counts in search rows. */
export function useCategoryCounts(): Record<string, number> {
  const { data: items } = useQuery(menuItemsQueryOptions({ is_active: true }));
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items ?? []) {
      counts[item.category_id] = (counts[item.category_id] ?? 0) + 1;
    }
    return counts;
  }, [items]);
}

/**
 * Category search dialog: type to filter, Enter picks the top match, tap a
 * row to jump the menu to that category. Reused by the /kot sidebar header
 * and the item-browser toolbar.
 */
export function CategorySearchDialog({
  open,
  onOpenChange,
  categories,
  counts,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MenuCategory[];
  counts: Record<string, number>;
  value: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(needle));
  }, [categories, q]);
  const pick = (id: string | null) => {
    onSelect(id);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search categories</DialogTitle>
          <DialogDescription>Type to filter — Enter jumps to the top match.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pick(matches[0]?.id ?? null);
              }
            }}
            className="pl-8"
            aria-label="Search categories"
          />
        </div>
        <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted touch-manipulation"
          >
            <Icons.layoutList className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium">All categories</span>
            {value == null && <Icons.check className="size-4 shrink-0 text-primary" />}
          </button>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              aria-label={`Show ${c.name}, ${counts[c.id] ?? 0} items`}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted touch-manipulation"
            >
              <Icons.tag className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{c.name}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {counts[c.id] ?? 0}
              </span>
              {value === c.id && <Icons.check className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
          {matches.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No categories match — try another search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

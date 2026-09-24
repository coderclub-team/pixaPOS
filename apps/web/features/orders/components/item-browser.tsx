"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { DataTablePagination } from "@pixa/ui/base-ui/table/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { addOrderItem, removeDraftItem, updateDraftItemQty } from "@/features/orders/api/service";
import { eventKeys } from "@/features/events/api/queries";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import type { MenuItem } from "@/features/menu/api/types";
import type { OrderItemSnapshot } from "@/features/orders/api/types";
import { PickItemDialog } from "./item-picker";

const VIEW_KEY = "pixaItemBrowserView";

type BrowserView = "card" | "list";

function defaultVariantOf(item: MenuItem) {
  const variants = item.variants ?? [];
  return variants.find((v) => v.is_default) ?? variants[0];
}

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

function priceOf(item: MenuItem): number {
  return toPaise(defaultVariantOf(item)?.selling_price ?? 0);
}

function imageOf(item: MenuItem): string | null {
  return item.image_url ?? item.images?.[0]?.url ?? item.image_urls?.[0] ?? null;
}

export function MenuImage({ item, size }: { item: MenuItem; size: "sm" | "lg" }) {
  const src = imageOf(item);
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary",
          size === "lg" ? "h-24 w-full text-2xl" : "size-12 text-base",
        )}
      >
        {initials}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-lg bg-muted",
        size === "lg" ? "h-24 w-full" : "size-12",
      )}
    >
      <Image src={src} alt="" fill sizes="160px" className="object-cover" />
    </span>
  );
}

/**
 * Inline menu browser: static category sidebar, List/Card toggle (Card
 * default, persisted), live draft counters. Adds land as unfired draft lines
 * visible in the bill KOTs tab — no fire footer, no Done button here.
 */
export default function ItemBrowser({ orderId }: { orderId: string }) {
  const [search, setSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<MenuItem | null>(null);
  const [view, setView] = useState<BrowserView>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as BrowserView | null) ?? "card";
    } catch {
      return "card";
    }
  });
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId ?? undefined,
      is_active: true,
    }),
  );

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {}
  }, [view]);

  // List pagination: default page size fits the visible list height
  // (header + footer subtracted, ~64px per row), clamped 5–30.
  const listRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState(10);
  const [pageSizeOverride, setPageSizeOverride] = useState<number | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const compute = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const fit = Math.floor((h - 40 - 52) / 64);
      setFitSize(Math.min(30, Math.max(5, fit || 10)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const autoPageSize = pageSizeOverride ?? fitSize;

  const draftLines = useMemo(() => (order?.items ?? []).filter((i) => !i.kot_id), [order?.items]);

  const invalidateOrder = () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: eventKeys.byOrder(orderId) });
  };

  const addMut = useMutation({
    mutationFn: (v: {
      menu_item_id: string;
      variant_id?: string;
      modifier_ids?: string[];
      qty: number;
      instructions?: string;
    }) => addOrderItem(orderId, v),
    onSuccess: () => {
      invalidateOrder();
      setPicked(null);
      toast.success("Added to draft KOT");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const quickAdd = (item: MenuItem) => {
    const existing = draftLines.find((l) => isDefaultConfigLine(item, l));
    if (existing) {
      qtyMut.mutate({ lineId: existing.id, qty: existing.qty + 1 });
      return;
    }
    const dv = defaultVariantOf(item);
    addMut.mutate({ menu_item_id: item.id, variant_id: dv?.id, modifier_ids: [], qty: 1 });
  };

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

  const allItems = items ?? [];

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );
  const visibleCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return activeCategories;
    return activeCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [activeCategories, categorySearch]);

  const stepper = (item: MenuItem, staged: number) => (
    <span
      className={cn(
        "flex items-center rounded-full border tabular-nums",
        staged > 0 ? "border-primary/40 bg-primary/10" : "border-border bg-muted",
      )}
      aria-live="polite"
      aria-label={`${item.name} draft quantity: ${staged}`}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full max-lg:h-9 max-lg:w-9"
        disabled={staged <= 0 || qtyMut.isPending || removeMut.isPending}
        onClick={() => stepDefault(item, -1)}
        aria-label={`Remove one ${item.name}`}
      >
        <Icons.minus className="size-3.5" />
      </Button>
      <span
        className={cn(
          "min-w-7 text-center text-xs font-bold",
          staged > 0 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {staged}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full max-lg:h-9 max-lg:w-9"
        disabled={addMut.isPending || qtyMut.isPending}
        onClick={() => stepDefault(item, 1)}
        aria-label={`Add one ${item.name}`}
      >
        <Icons.add className="size-3.5" />
      </Button>
    </span>
  );

  return (
    <div className="flex h-full min-h-0 gap-3">
      <nav
        aria-label="Menu categories"
        className="flex w-44 shrink-0 flex-col gap-2 self-stretch rounded-xl border p-2 sm:w-52"
      >
        <div className="relative shrink-0">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories…"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <Button
            type="button"
            variant={categoryId == null ? "default" : "ghost"}
            size="sm"
            className="h-9 shrink-0 justify-start text-xs"
            onClick={() => setCategoryId(null)}
          >
            All
          </Button>
          {visibleCategories.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant={categoryId === c.id ? "default" : "ghost"}
              size="sm"
              className="h-9 shrink-0 justify-start truncate text-xs"
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              title={c.name}
            >
              {c.name}
            </Button>
          ))}
          {visibleCategories.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No categories match.
            </p>
          )}
        </div>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Menu layout">
            <Button
              type="button"
              variant={view === "card" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setView("card")}
              title="Card view"
            >
              <Icons.cards className="size-4" />
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setView("list")}
              title="List view"
            >
              <Icons.layoutList className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto pr-0.5">
          {isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading menu…</p>
          ) : !items?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No menu items match. Try another search or category.
              </CardContent>
            </Card>
          ) : view === "card" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.slice(0, 60).map((item) => {
                const staged = draftQtyFor(item);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.name} — tap to add, in draft ${staged}`}
                    onClick={() => quickAdd(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        quickAdd(item);
                      }
                    }}
                    className="cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <MenuImage item={item} size="lg" />
                    <p className="mt-2 truncate text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "inline-block size-2 rounded-full",
                          item.veg_type === "veg" ? "bg-green-600" : "bg-red-600",
                        )}
                      />
                      {item.category_name}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{formatINR(priceOf(item))}</p>
                    <div
                      className="mt-2 flex items-center justify-between gap-1"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {stepper(item, staged)}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        onClick={() => setPicked(item)}
                        title="Customize — variants, add-ons, instructions"
                        aria-label={`Customize ${item.name}`}
                      >
                        <Icons.edit className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <PickerListTable
              items={allItems}
              pageSize={autoPageSize}
              onPageSizeChange={setPageSizeOverride}
              autoSize={pageSizeOverride == null ? autoPageSize : null}
              resetKey={`${search}|${categoryId ?? "all"}|${allItems.length}`}
              draftQtyFor={draftQtyFor}
              stepper={stepper}
              onAdd={quickAdd}
              listRef={listRef}
            />
          )}
        </div>
      </div>

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

/**
 * List view as a clean data table: sortable Item/Price headers, tap-row to
 * add, stepper in Qty, shared pagination footer. Page size defaults to the
 * measured viewport fit (`autoSize`); the footer select overrides manually.
 */
function PickerListTable({
  items,
  pageSize,
  onPageSizeChange,
  autoSize,
  resetKey,
  draftQtyFor,
  stepper,
  onAdd,
  listRef,
}: {
  items: MenuItem[];
  pageSize: number;
  onPageSizeChange: (n: number | null) => void;
  autoSize: number | null;
  resetKey: string;
  draftQtyFor: (item: MenuItem) => number;
  stepper: (item: MenuItem, staged: number) => React.ReactNode;
  onAdd: (item: MenuItem) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [manualSize, setManualSize] = useState(false);

  const columns = useMemo<ColumnDef<MenuItem>[]>(
    () => [
      {
        id: "item",
        accessorFn: (item) => item.name,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-1 text-xs font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            title="Sort by name"
          >
            Item
            <Icons.chevronsUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <span className="flex min-w-0 items-center gap-3">
              <MenuImage item={item} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      item.veg_type === "veg" ? "bg-green-600" : "bg-red-600",
                    )}
                  />
                  {item.category_name}
                </span>
              </span>
            </span>
          );
        },
      },
      {
        id: "price",
        accessorFn: (item) => priceOf(item),
        header: ({ column }) => (
          <span className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-1 text-xs font-medium"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              title="Sort by price"
            >
              Price
              <Icons.chevronsUpDown className="size-3.5" />
            </Button>
          </span>
        ),
        cell: ({ row }) => (
          <span className="block text-right text-sm font-semibold tabular-nums">
            {formatINR(priceOf(row.original))}
          </span>
        ),
      },
      {
        id: "qty",
        enableSorting: false,
        header: () => <span className="block text-right text-xs font-medium">Qty</span>,
        cell: ({ row }) => (
          <span
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {stepper(row.original, draftQtyFor(row.original))}
          </span>
        ),
      },
    ],
    [draftQtyFor, stepper],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  // Viewport-fit default: follow the measured size until the user overrides.
  useEffect(() => {
    if (!manualSize) table.setPageSize(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // New result set → first page.
  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <Card>
      <CardContent className="p-0">
        <div ref={listRef} className="min-h-[200px]">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className={h.column.id !== "item" ? "text-right" : undefined}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const item = row.original;
                  const staged = draftQtyFor(item);
                  return (
                    <TableRow
                      key={row.id}
                      tabIndex={0}
                      aria-label={`${item.name} — tap to add, in draft ${staged}`}
                      onClick={() => onAdd(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onAdd(item);
                        }
                      }}
                      className="cursor-pointer transition-all duration-150 ease-out hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/[0.08]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No menu items match. Try another search or category.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {items.length === 0
              ? "No items"
              : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min(items.length, (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize)} of ${items.length}`}
            {autoSize != null ? ` · auto (${autoSize}/page)` : ""}
          </p>
          <div className="flex items-center gap-1">
            <select
              aria-label="Rows per page"
              className="h-8 rounded-md border bg-background px-1 text-xs"
              value={manualSize ? String(table.getState().pagination.pageSize) : "auto"}
              onChange={(e) => {
                if (e.target.value === "auto") {
                  setManualSize(false);
                  onPageSizeChange(null);
                } else {
                  setManualSize(true);
                  const n = Number(e.target.value);
                  table.setPageSize(n);
                  onPageSizeChange(n);
                }
              }}
            >
              <option value="auto">Auto</option>
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <Icons.chevronLeft className="size-4" />
            </Button>
            <span className="min-w-14 text-center text-xs font-medium tabular-nums">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <Icons.chevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

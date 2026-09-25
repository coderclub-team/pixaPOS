"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@pixa/ui/base-ui/sidebar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { addOrderItem, removeDraftItem, updateDraftItemQty } from "@/features/orders/api/service";
import { eventKeys } from "@/features/events/api/queries";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useMediaQuery } from "@pixa/ui/hooks/use-media-query";
import type { MenuItem, VegType } from "@/features/menu/api/types";
import type { OrderItemSnapshot } from "@/features/orders/api/types";
import { useCategorySelection } from "./category-selection";

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

/** Lowest variant price (paise) — "From ₹X" label for variant parents. */
function minPriceOf(item: MenuItem): number {
  const prices = (item.variants ?? []).map((v) => v.selling_price ?? 0);
  if (prices.length === 0) return priceOf(item);
  return toPaise(Math.min(...prices));
}

/** Variant products expand inline (Odoo/Zoho pattern): one sub-row per
 * variant with its own price + stepper, instead of overloading one row. */
function hasVariantOptions(item: MenuItem): boolean {
  return (
    item.product_type === "variant" &&
    (item.variants ?? []).filter((v) => v.is_active !== false).length > 1
  );
}

function isVariantConfigLine(
  item: MenuItem,
  variantId: string | undefined,
  line: OrderItemSnapshot,
): boolean {
  return (
    !line.kot_id &&
    line.menu_item_id === item.id &&
    (line.variant_id ?? undefined) === variantId &&
    (line.modifiers?.length ?? 0) === 0 &&
    !line.instructions
  );
}

function imageOf(item: MenuItem): string | null {
  return item.image_url ?? item.images?.[0]?.url ?? item.image_urls?.[0] ?? null;
}

export function MenuImage({
  item,
  size,
}: {
  item: MenuItem;
  size: "sm" | "lg" | "cover" | "fill";
}) {
  const src = imageOf(item);
  // A dead CDN URL degrades to the initials block instead of a broken icon.
  const [failed, setFailed] = useState(false);
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center bg-primary/10 font-bold text-primary",
          size === "lg"
            ? "h-24 w-full rounded-lg text-2xl"
            : size === "cover"
              ? "h-28 w-full text-2xl"
              : size === "fill"
                ? "absolute inset-0 text-4xl"
                : "size-12 rounded-lg text-base",
        )}
      >
        {initials}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-muted",
        size === "lg"
          ? "h-24 w-full rounded-lg"
          : size === "cover"
            ? "h-28 w-full"
            : size === "fill"
              ? "absolute inset-0"
              : "size-12 rounded-lg",
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="240px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
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
  const [vegType, setVegType] = useState<VegType | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  // Page-level selection (kot app sidebar) wins when provided; otherwise the
  // browser keeps its own internal sidebar selection (dashboard usage).
  const sharedSelection = useCategorySelection();
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(null);
  const categoryId = sharedSelection?.categoryId ?? localCategoryId;
  const setCategoryId = sharedSelection?.setCategoryId ?? setLocalCategoryId;
  const pageSidebar = sharedSelection != null;
  // Multi-variant card tap target — opens the variant picker dialog.
  const [variantPick, setVariantPick] = useState<MenuItem | null>(null);
  const [view, setView] = useState<BrowserView>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as BrowserView | null) ?? "card";
    } catch {
      return "card";
    }
  });
  // Collapsible category sidebar (dashboard pattern): open on desktop,
  // closed on mobile; manual toggle wins once touched.
  const { isOpen: isMobile } = useMediaQuery();
  const [catTouched, setCatTouched] = useState(false);
  const [catOpenManual, setCatOpenManual] = useState(true);
  const sidebarOpen = catTouched ? catOpenManual : !isMobile;
  // Card view is the only layout on phones; larger screens keep the toggle.
  const effectiveView: BrowserView = isMobile ? "card" : view;
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId ?? undefined,
      veg_type: vegType ?? undefined,
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

  /** Variant-aware stepping for table sub-rows (any single variant). */
  const stepVariant = (item: MenuItem, variantId: string | undefined, delta: number) => {
    const existing = draftLines.find((l) => isVariantConfigLine(item, variantId, l));
    if (!existing) {
      if (delta <= 0) return;
      addMut.mutate({ menu_item_id: item.id, variant_id: variantId, modifier_ids: [], qty: 1 });
      return;
    }
    const next = existing.qty + delta;
    if (next <= 0) removeMut.mutate(existing.id);
    else qtyMut.mutate({ lineId: existing.id, qty: next });
  };

  const draftQtyForVariant = (item: MenuItem, variantId: string | undefined) =>
    draftLines
      .filter((l) => isVariantConfigLine(item, variantId, l))
      .reduce((s, l) => s + l.qty, 0);

  /** Total drafted units across all plain variants of an item. */
  const draftTotalFor = (item: MenuItem) =>
    draftLines
      .filter(
        (l) => l.menu_item_id === item.id && (l.modifiers?.length ?? 0) === 0 && !l.instructions,
      )
      .reduce((s, l) => s + l.qty, 0);

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

  const stepper = (item: MenuItem, staged: number, variantId?: string) => (
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
        onClick={() =>
          variantId !== undefined ? stepVariant(item, variantId, -1) : stepDefault(item, -1)
        }
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
        onClick={() =>
          variantId !== undefined ? stepVariant(item, variantId, 1) : stepDefault(item, 1)
        }
        aria-label={`Add one ${item.name}`}
      >
        <Icons.add className="size-3.5" />
      </Button>
    </span>
  );

  return (
    <div className="relative flex h-full min-h-0 gap-3">
      {/* Categories live in the page app sidebar when provided (/kot);
          otherwise the browser keeps its own panel-embedded sidebar. */}
      {pageSidebar ? null : (
        <>
          {/* Mobile backdrop for the category drawer. */}
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close categories"
              onClick={() => {
                setCatTouched(true);
                setCatOpenManual(false);
              }}
              className="absolute inset-0 z-20 bg-black/40 lg:hidden"
            />
          )}
          {/* Category sidebar: the exact dashboard sidebar primitives
          (provider + header + group + menu + buttons) in a panel-embedded
          container. group-data collapse selectors work exactly like /dashboard;
          the viewport-fixed Sidebar shell itself stays app-level only. */}
          <SidebarProvider
            open={sidebarOpen}
            onOpenChange={(open) => {
              setCatTouched(true);
              setCatOpenManual(open);
            }}
          >
            <nav
              aria-label="Menu categories"
              className={cn(
                "group shrink-0 flex-col self-stretch rounded-xl border bg-sidebar text-sidebar-foreground",
                sidebarOpen
                  ? "flex w-64 max-w-[82%] sm:w-56 lg:w-44 xl:w-52"
                  : "hidden lg:flex lg:w-14 lg:items-center",
                // Mobile open state renders as an overlay drawer.
                sidebarOpen &&
                  "absolute inset-y-0 left-0 z-30 shadow-xl lg:static lg:z-auto lg:shadow-none",
              )}
              data-collapsible={sidebarOpen ? "" : "icon"}
            >
              {sidebarOpen ? (
                <SidebarHeader>
                  <div className="relative">
                    <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search categories…"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="h-9 bg-sidebar pl-8 text-xs"
                    />
                  </div>
                </SidebarHeader>
              ) : null}
              <SidebarContent>
                <SidebarGroup>
                  {sidebarOpen ? <SidebarGroupLabel>Categories</SidebarGroupLabel> : null}
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={categoryId == null}
                        onClick={() => setCategoryId(null)}
                        tooltip="All categories"
                        className="group-data-[collapsible=icon]:justify-center"
                      >
                        <Icons.layoutList />
                        <span className="group-data-[collapsible=icon]:hidden">All</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {visibleCategories.map((c) => (
                      <SidebarMenuItem key={c.id}>
                        <SidebarMenuButton
                          isActive={categoryId === c.id}
                          onClick={() => {
                            setCategoryId(categoryId === c.id ? null : c.id);
                            if (isMobile) {
                              setCatTouched(true);
                              setCatOpenManual(false);
                            }
                          }}
                          tooltip={c.name}
                          className="group-data-[collapsible=icon]:justify-center"
                        >
                          <Icons.tag />
                          <span className="group-data-[collapsible=icon]:hidden">{c.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
                {sidebarOpen && visibleCategories.length === 0 && (
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-2 py-8 text-center">
                    <div className="rounded-full border border-dashed p-2.5">
                      <Icons.search className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No categories match</p>
                    <p className="text-xs text-muted-foreground">Try another search.</p>
                  </div>
                )}
              </SidebarContent>
            </nav>
          </SidebarProvider>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {pageSidebar ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 shrink-0 px-0"
              onClick={() => {
                setCatTouched(true);
                setCatOpenManual((v) => !v);
              }}
              title={sidebarOpen ? "Hide categories" : "Show categories"}
              aria-label={sidebarOpen ? "Hide categories" : "Show categories"}
              aria-expanded={sidebarOpen}
            >
              <Icons.panelLeft className="size-4" />
            </Button>
          )}
          <div className="relative min-w-40 flex-1">
            <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div
            className="flex rounded-lg border p-0.5"
            role="group"
            aria-label="Dietary preference"
          >
            {(
              [
                { label: "All", value: null, dot: null },
                { label: "Veg", value: "veg", dot: "bg-green-600" },
                { label: "Non-veg", value: "nonveg", dot: "bg-destructive" },
                { label: "Egg", value: "egg", dot: "bg-amber-500" },
              ] as const
            ).map((o) => (
              <Button
                key={o.label}
                type="button"
                variant={vegType === o.value ? "default" : "ghost"}
                size="sm"
                className="h-9 min-h-9 px-2.5 text-xs touch-manipulation"
                onClick={() => setVegType(o.value)}
                title={`${o.label} — dietary preference`}
                aria-pressed={vegType === o.value}
              >
                {o.dot && <span className={cn("size-2 rounded-full", o.dot)} />}
                {o.label}
              </Button>
            ))}
          </div>
          <div
            className="hidden rounded-lg border p-0.5 sm:flex"
            role="group"
            aria-label="Menu layout"
          >
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
              <CardContent className="py-12 text-center">
                <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                  <div className="rounded-full border border-dashed p-3">
                    <Icons.pizza className="size-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">No menu items match</p>
                  <p className="text-sm text-muted-foreground">
                    Try another search, category or diet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : effectiveView === "card" ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
              {items.slice(0, 60).map((item) => {
                // Multi-variant products open the variant dialog on tap —
                // cards stay clean no matter how many options an item has.
                // Single-variant items behave as default (tap adds straight).
                const variable = hasVariantOptions(item);
                const staged = variable ? draftTotalFor(item) : draftQtyFor(item);
                const activeVariants = (item.variants ?? []).filter((v) => v.is_active !== false);
                const activate = () => {
                  if (variable) setVariantPick(item);
                  else quickAdd(item);
                };
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      variable
                        ? `${item.name} — ${activeVariants.length} options, ${staged} in draft`
                        : `${item.name} — tap to add, in draft ${staged}`
                    }
                    onClick={activate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate();
                      }
                    }}
                    className={cn(
                      "relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-muted transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary",
                    )}
                  >
                    <MenuImage item={item} size="fill" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-3 pt-8 text-white">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
                        <span
                          className={cn(
                            "inline-block size-2 rounded-full",
                            item.veg_type === "veg"
                              ? "bg-green-500"
                              : item.veg_type === "egg"
                                ? "bg-amber-400"
                                : "bg-red-500",
                          )}
                        />
                        {item.category_name}
                        {variable && <span> · {activeVariants.length} options</span>}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {variable
                          ? `From ${formatINR(minPriceOf(item))}`
                          : formatINR(priceOf(item))}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold tabular-nums text-white/75">
                          {staged > 0 ? `${staged}× in draft` : ""}
                        </span>
                      </div>
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
              resetKey={`${search}|${categoryId ?? "all"}|${vegType ?? "all"}|${allItems.length}`}
              draftQtyFor={draftQtyFor}
              draftQtyForVariant={draftQtyForVariant}
              draftTotalFor={draftTotalFor}
              stepper={stepper}
              onAdd={quickAdd}
              onAddVariant={(item, variantId) => stepVariant(item, variantId, 1)}
              listRef={listRef}
            />
          )}
        </div>
      </div>

      {variantPick && (
        <VariantPickerDialog
          item={variantPick}
          total={draftTotalFor(variantPick)}
          qtyFor={(variantId) => draftQtyForVariant(variantPick, variantId)}
          onStep={(variantId, delta) => stepVariant(variantPick, variantId, delta)}
          onClose={() => setVariantPick(null)}
        />
      )}
    </div>
  );
}

/**
 * Variant picker dialog for multi-variant cards: one row per active variant
 * with its own live stepper (adds land as draft lines immediately, like the
 * list-view sub-rows). Stays open across picks; Done closes. No modifiers or
 * instructions — the /kot flow keeps those out by design.
 */
function VariantPickerDialog({
  item,
  total,
  qtyFor,
  onStep,
  onClose,
}: {
  item: MenuItem;
  total: number;
  qtyFor: (variantId: string | undefined) => number;
  onStep: (variantId: string | undefined, delta: number) => void;
  onClose: () => void;
}) {
  const variants = (item.variants ?? []).filter((v) => v.is_active !== false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {item.category_name} · {item.veg_type === "veg" ? "Veg" : "Non-veg"} — pick variants,
            each lands in the draft
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-1.5 overflow-y-auto">
          {variants.map((v) => {
            const staged = qtyFor(v.id);
            return (
              <div key={v.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {v.qty ? `${v.qty}${v.unit ?? ""} · ` : ""}
                    {formatINR(toPaise(v.selling_price ?? 0))}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex items-center rounded-full border tabular-nums",
                    staged > 0 ? "border-primary/40 bg-primary/10" : "border-border bg-muted",
                  )}
                  aria-live="polite"
                  aria-label={`${item.name} ${v.name} draft quantity: ${staged}`}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full max-lg:h-11 max-lg:w-11"
                    disabled={staged <= 0}
                    onClick={() => onStep(v.id, -1)}
                    aria-label={`Remove one ${item.name} ${v.name}`}
                  >
                    <Icons.minus className="size-4" />
                  </Button>
                  <span
                    className={cn(
                      "min-w-7 text-center text-sm font-bold",
                      staged > 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {staged}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full max-lg:h-11 max-lg:w-11"
                    onClick={() => onStep(v.id, 1)}
                    aria-label={`Add one ${item.name} ${v.name}`}
                  >
                    <Icons.add className="size-4" />
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {total > 0 ? `${total}× in draft` : "Nothing picked yet"}
          </p>
          <Button onClick={onClose} className="min-h-11">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  draftQtyForVariant,
  draftTotalFor,
  stepper,
  onAdd,
  onAddVariant,
  listRef,
}: {
  items: MenuItem[];
  pageSize: number;
  onPageSizeChange: (n: number | null) => void;
  autoSize: number | null;
  resetKey: string;
  draftQtyFor: (item: MenuItem) => number;
  draftQtyForVariant: (item: MenuItem, variantId: string | undefined) => number;
  draftTotalFor: (item: MenuItem) => number;
  stepper: (item: MenuItem, staged: number, variantId?: string) => React.ReactNode;
  onAdd: (item: MenuItem) => void;
  onAddVariant: (item: MenuItem, variantId: string | undefined) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [manualSize, setManualSize] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          const variant = hasVariantOptions(item);
          return (
            <span className="flex min-w-0 items-center gap-3">
              <MenuImage item={item} size="sm" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  {variant && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {(item.variants ?? []).length} options
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      item.veg_type === "veg"
                        ? "bg-green-600"
                        : item.veg_type === "egg"
                          ? "bg-amber-500"
                          : "bg-red-600",
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
        accessorFn: (item) => (hasVariantOptions(item) ? minPriceOf(item) : priceOf(item)),
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
        cell: ({ row }) => {
          const item = row.original;
          return (
            <span className="block text-right text-sm font-semibold tabular-nums">
              {hasVariantOptions(item)
                ? `From ${formatINR(minPriceOf(item))}`
                : formatINR(priceOf(item))}
            </span>
          );
        },
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

  // New result set → first page, collapse variant rows.
  useEffect(() => {
    table.setPageIndex(0);
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <Card>
      <CardContent className="p-0">
        <div ref={listRef} className="min-h-[200px] overflow-x-auto">
          <Table className="min-w-[520px]">
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
                  const variant = hasVariantOptions(item);
                  const staged = variant ? draftTotalFor(item) : draftQtyFor(item);
                  const expanded = expandedId === item.id;
                  const toggle = () => setExpandedId((prev) => (prev === item.id ? null : item.id));
                  const activate = () => {
                    if (variant) toggle();
                    else onAdd(item);
                  };
                  return (
                    <Fragment key={row.id}>
                      <TableRow
                        tabIndex={0}
                        aria-expanded={variant ? expanded : undefined}
                        aria-label={
                          variant
                            ? `${item.name} — ${expanded ? "hide" : "show"} ${(item.variants ?? []).length} options, ${staged} in draft`
                            : `${item.name} — tap to add, in draft ${staged}`
                        }
                        onClick={activate}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            activate();
                          }
                        }}
                        className={cn(
                          "cursor-pointer transition-all duration-150 ease-out hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/[0.08]",
                          expanded && "bg-primary/[0.06]",
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {cell.column.id === "item" ? (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Icons.chevronRight
                                  className={cn(
                                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                    expanded && "rotate-90",
                                    !variant && "invisible",
                                  )}
                                />
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </span>
                            ) : cell.column.id === "qty" && variant ? (
                              <span
                                className="flex justify-end"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                  {staged > 0 ? `${staged}× in draft` : ""}
                                </span>
                              </span>
                            ) : (
                              flexRender(cell.column.columnDef.cell, cell.getContext())
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      {variant &&
                        expanded &&
                        (item.variants ?? [])
                          .filter((v) => v.is_active !== false)
                          .map((v) => {
                            const vStaged = draftQtyForVariant(item, v.id);
                            return (
                              <TableRow
                                key={`${row.id}-${v.id}`}
                                tabIndex={0}
                                aria-label={`${item.name} ${v.name} — tap to add, in draft ${vStaged}`}
                                onClick={() => onAddVariant(item, v.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onAddVariant(item, v.id);
                                  }
                                }}
                                className="cursor-pointer bg-muted/40 transition-all duration-150 ease-out hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/[0.08]"
                              >
                                <TableCell>
                                  <span className="flex min-w-0 items-center gap-3 pl-8">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-medium">
                                        {v.name}
                                      </span>
                                      <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {v.qty ? `${v.qty}${v.unit ?? ""} · ` : ""}
                                        {item.category_name}
                                      </span>
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold tabular-nums">
                                  {formatINR(toPaise(v.selling_price ?? 0))}
                                </TableCell>
                                <TableCell
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <span className="flex justify-end">
                                    {stepper(item, vStaged, v.id)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                    </Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No menu items match. Try another search, category or diet.
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
            <Select
              value={manualSize ? String(table.getState().pagination.pageSize) : "auto"}
              onValueChange={(value) => {
                if (value === "auto") {
                  setManualSize(false);
                  onPageSizeChange(null);
                } else {
                  setManualSize(true);
                  const n = Number(value);
                  table.setPageSize(n);
                  onPageSizeChange(n);
                }
              }}
            >
              <SelectTrigger
                className="h-8 w-[5.5rem] text-xs [&[data-size]]:h-8"
                aria-label="Rows per page"
              >
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  <SelectItem value="auto">Auto</SelectItem>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <SelectItem key={n} value={`${n}`}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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

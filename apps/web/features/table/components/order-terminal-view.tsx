"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@pixa/ui/base-ui/tabs";
import FloorPlanCanvas from "@/features/table/components/floor-plan-canvas";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { floorLayoutQueryOptions, floorKeys } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { seatOccupancy } from "@/features/table/api/service";
import { partyHex } from "@/features/table/api/utils";
import type { OccupancyGroup } from "@/features/table/api/types";
import { orderKeys, ordersQueryOptions } from "@/features/orders/api/queries";
import { ensureBareTableOrder, ensureGroupOrder } from "@/features/orders/api/service";
import { Button } from "@pixa/ui/base-ui/button";
import ItemPicker from "@/features/orders/components/item-picker";
import OrderBillPanel from "@/features/orders/components/bill-panel";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";
import { toast } from "sonner";

const PANEL_EXIT_MS = 300;

export default function OrderTerminalPage({
  hideDescription = false,
  hideTitle = false,
}: {
  hideDescription?: boolean;
  hideTitle?: boolean;
}) {
  useCrossTabSync();
  const queryClient = useQueryClient();
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);
  const [seatCount, setSeatCount] = useState(2);
  const [mobileView, setMobileView] = useState<"tables" | "order" | "items">("tables");
  const exitTimer = useRef<number | null>(null);

  const { data: activeTable } = useQuery({
    ...tableQueryOptions(activeTableId ?? ""),
    enabled: !!activeTableId,
  });

  useEffect(
    () => () => {
      if (exitTimer.current != null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  const ensureMut = useMutation({
    // Bare-single flow: tap selects + ensures one silent 1-guest party order.
    // The explicit seat dialog stays the full party flow.
    mutationFn: (tableId: string) => ensureBareTableOrder(tableId),
    onSuccess: (order, tableId) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      if (exitTimer.current != null) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setActiveTableId(tableId);
      setActiveOrderId(order.id);
      setActiveGroupId(order.occupancy_group_id ?? null);
      setPanelOpen(true);
      setMobileView("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Press-and-hold a party chip: ensure that party's order and jump straight to picking. */
  const ensureGroupMut = useMutation({
    mutationFn: ({ tableId, groupId }: { tableId: string; groupId: string }) =>
      ensureGroupOrder(groupId),
    onSuccess: (order, { tableId, groupId }) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      if (exitTimer.current != null) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setActiveTableId(tableId);
      setActiveGroupId(groupId);
      setActiveOrderId(order.id);
      setPanelOpen(true);
      setPickerOpen(true);
      setMobileView("items");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Seat a new party on the active (shared) table. */
  const seatMut = useMutation({
    mutationFn: ({ tableId, seats }: { tableId: string; seats: number }) =>
      seatOccupancy({ table_id: tableId, seats }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: floorKeys.layout(group.floor_id) });
      setActiveGroupId(group.id);
      setActiveOrderId(group.order_id);
      setSeatOpen(false);
      setPanelOpen(true);
      setMobileView("order");
      toast.success(`Party ${group.label ?? ""} seated — tap Start order or hold its chip`.trim());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Tap: select a table (its bill loads into the always-visible panel).
   * Tapping the selected table (or floor background) again deselects back to
   * the empty placeholder; on mobile this also dismisses the bottom sheet. */
  const handleTap = (id: string | null) => {
    if (ensureMut.isPending) return;
    if (id == null || id === activeTableId) {
      setPickerOpen(false);
      setPanelOpen(false);
      setMobileView("tables");
      exitTimer.current = window.setTimeout(() => {
        setActiveTableId(null);
        setActiveOrderId(null);
        setActiveGroupId(null);
        exitTimer.current = null;
      }, PANEL_EXIT_MS);
      return;
    }
    ensureMut.mutate(id);
  };

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;

  // Groups come from the floor layout (table detail query is not enriched).
  const { data: layout } = useQuery({
    ...floorLayoutQueryOptions(currentFloorId ?? ""),
    enabled: !!currentFloorId,
  });
  const activeTableDerived = layout?.tables.find((t) => t.id === activeTableId) ?? null;
  const groups: OccupancyGroup[] = activeTableDerived?.active_groups ?? [];
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  // Live (non-terminal) orders on this table, keyed by party.
  const { data: tableOrders } = useQuery({
    ...ordersQueryOptions({ table_id: activeTableId ?? "" }),
    enabled: !!activeTableId,
  });
  const liveOrders = (tableOrders ?? []).filter(
    (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED",
  );
  const liveOrderByGroup = new Map(
    liveOrders.filter((o) => o.occupancy_group_id).map((o) => [o.occupancy_group_id as string, o]),
  );
  const groupIds = new Set(groups.map((g) => g.id));
  // Detached open tabs: live orders whose party is gone — still payable.
  const openTabs = liveOrders.filter(
    (o) => !o.occupancy_group_id || !groupIds.has(o.occupancy_group_id),
  );

  /** Tap a party chip: focus that party's bill. Never creates an order. */
  const handleSelectParty = (tableId: string, groupId: string) => {
    if (ensureMut.isPending || ensureGroupMut.isPending) return;
    if (exitTimer.current != null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (tableId !== activeTableId) {
      setActiveTableId(tableId);
      setActiveOrderId(null);
    }
    setActiveGroupId(groupId);
    setActiveOrderId(liveOrderByGroup.get(groupId)?.id ?? null);
    setPanelOpen(true);
    setMobileView("order");
  };

  /** Tap a detached open tab: focus its bill without any party. */
  const handleSelectTab = (orderId: string) => {
    if (ensureMut.isPending || ensureGroupMut.isPending) return;
    setActiveGroupId(null);
    setActiveOrderId(orderId);
    setPanelOpen(true);
    setMobileView("order");
  };

  /** Press-and-hold a party chip: ensure its order and open the picker. */
  const handleHoldParty = (tableId: string, groupId: string) => {
    if (ensureMut.isPending || ensureGroupMut.isPending) return;
    ensureGroupMut.mutate({ tableId, groupId });
  };

  if (isLoading) {
    return (
      <PageContainer pageTitle="Order Terminal" isLoading>
        <div />
      </PageContainer>
    );
  }

  // Bill panel is always mounted (desktop static column + mobile sheet).
  // Before any table selection it shows the empty placeholder below.

  return (
    <PageContainer
      pageTitle={hideTitle ? "" : "Order Terminal"}
      pageDescription={
        hideDescription
          ? undefined
          : "Tap a table for its bill. Works in a separate tab — sign-in carries over."
      }
      pageHeaderAction={
        hideDescription ? undefined : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/kot" target="_blank" />}
          >
            <Icons.externalLink className="mr-1 size-4" /> Open counter
          </Button>
        )
      }
    >
      <div className="relative flex min-h-0 flex-col gap-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:h-[calc(100dvh-200px)] lg:flex-row lg:gap-4 lg:pb-0">
        <div
          className={cn(
            "min-h-0 min-w-0 lg:flex-1",
            "h-[calc(100dvh-170px)] sm:h-[calc(100dvh-175px)] lg:h-auto",
            mobileView !== "tables" ? "hidden lg:block" : "block",
          )}
        >
          <Tabs
            value={currentFloorId}
            onValueChange={(v) => {
              setSelectedFloorId(v);
              setPickerOpen(false);
              setMobileView("tables");
            }}
            className="h-full"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 lg:mb-4 lg:flex-nowrap lg:justify-between">
              <TabsList className="max-w-full overflow-x-auto">
                {activeFloors.map((f) => (
                  <TabsTrigger
                    key={f.id}
                    value={f.id}
                    className="min-h-11 shrink-0 px-4 touch-manipulation"
                  >
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {activeTable ? (
                <Badge variant="outline" className="gap-1 border-primary text-primary">
                  <div className="h-2 w-2 rounded-full bg-primary" /> Taking order — Table{" "}
                  {activeTable.number}
                  {activeGroup ? ` · Party ${activeGroup.label ?? "?"}` : ""}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-green-500 text-green-600"
                  title="Tap a table to open its bill · tap the selected table again to deselect"
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Tap a table for bill &
                  seating
                </Badge>
              )}
            </div>
            {activeFloors.map((f) => (
              <TabsContent key={f.id} value={f.id} className="h-[calc(100%-60px)]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                  <FloorPlanCanvas
                    floorId={f.id}
                    mode="operations"
                    selectedTableId={activeTableId ?? undefined}
                    onSelectTable={handleTap}
                    activeGroupId={activeGroupId ?? undefined}
                    onSelectParty={handleSelectParty}
                    onHoldParty={handleHoldParty}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <>
          <div
            className={cn(
              "shrink-0 overflow-hidden transition-all duration-300 ease-out",
              // Mobile: bottom sheet sliding up from the screen edge.
              "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] rounded-t-2xl border-t bg-background shadow-2xl",
              // Desktop: always-visible docked side column (no open/close).
              "sm:max-h-[82dvh] lg:static lg:z-auto lg:max-h-none lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:w-[420px] xl:w-[480px]",
              // Mobile sheet hides until a table is tapped.
              panelOpen
                ? "translate-y-0 opacity-100"
                : "max-lg:pointer-events-none max-lg:translate-y-full max-lg:opacity-0",
            )}
          >
            <div className="max-h-[88dvh] scroll-pt-12 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-h-[82dvh] lg:h-full lg:max-h-none lg:w-auto lg:overflow-visible lg:pb-0">
              {/* Mobile sheet grab handle + close */}
              <div className="sticky top-0 z-10 flex items-center justify-center bg-background/95 pt-2 pb-1 backdrop-blur-sm lg:hidden">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                <button
                  type="button"
                  aria-label="Close bill panel"
                  onClick={() => handleTap(null)}
                  className="absolute right-2 top-1 flex size-11 items-center justify-center rounded-md text-muted-foreground touch-manipulation"
                >
                  <Icons.close className="size-5" />
                </button>
              </div>
              <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur lg:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 touch-manipulation"
                  aria-label="Back to tables"
                  onClick={() => {
                    setPanelOpen(false);
                    setMobileView("tables");
                  }}
                >
                  <Icons.chevronLeft className="size-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {activeTable ? `Table ${activeTable.number}` : "Order"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {activeGroup ? `Party ${activeGroup.label ?? "?"}` : "Current order"}
                  </div>
                </div>
              </div>

              {/* Party strip: one tap-target per seated party + seat-new-party.
                  Shows whenever the table has parties or accepts sharing. */}
              {activeTableDerived &&
                (groups.length > 0 || openTabs.length > 0 || activeTableDerived.allows_sharing) && (
                  <div className="flex items-center gap-2 overflow-x-auto border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
                    <Icons.party className="size-4 shrink-0 text-muted-foreground" />
                    {groups.map((g, i) => {
                      const live = liveOrderByGroup.has(g.id);
                      const focused = g.id === activeGroupId;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => activeTableId && handleSelectParty(activeTableId, g.id)}
                          aria-label={`Party ${g.label ?? "?"}, ${g.seats} guests${live ? ", order open" : ""}`}
                          title={`Party ${g.label ?? "?"} — tap to focus${live ? "" : " · no order yet"}`}
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs font-medium transition-colors",
                            focused
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span
                            className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: partyHex(g.color_index ?? i) }}
                          >
                            {g.label ?? "?"}
                          </span>
                          {g.seats}
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              live ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600",
                            )}
                            title={live ? "Order open" : "No order yet"}
                          />
                        </button>
                      );
                    })}
                    {openTabs.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSelectTab(o.id)}
                        aria-label={`Open tab ${o.order_number}, party released`}
                        title={`${o.order_number} — party released, still payable`}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-full border border-dashed py-1 px-2.5 text-xs font-medium transition-colors",
                          o.id === activeOrderId && !activeGroupId
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icons.orders className="size-3.5" />
                        {o.order_number}
                      </button>
                    ))}
                    {(() => {
                      const free =
                        activeTableDerived.capacity - (activeTableDerived.seated_seats ?? 0);
                      return free > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSeatCount(Math.min(2, free));
                            setSeatOpen(true);
                          }}
                          aria-label={`Seat a new party, ${free} seats free`}
                          title={`Seat a new party (${free} free)`}
                          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Icons.add className="size-3.5" /> Party
                        </button>
                      ) : null;
                    })()}
                  </div>
                )}
              {activeOrderId && activeTable ? (
                <OrderBillPanel
                  orderId={activeOrderId}
                  title={`Bill — Table ${activeTable.number}${activeGroup ? ` · Party ${activeGroup.label ?? "?"}` : openTabs.some((o) => o.id === activeOrderId) ? " · open tab" : ""}`}
                  showSeating
                  showCustomer
                  onAddItems={() => {
                    setPickerOpen(true);
                    setMobileView("items");
                  }}
                  fit="fill"
                  onCompleted={() => {
                    queryClient.invalidateQueries({ queryKey: tableKeys.all });
                    queryClient.invalidateQueries({ queryKey: orderKeys.all });
                    setPickerOpen(false);
                    setPanelOpen(false);
                    setMobileView("tables");
                    exitTimer.current = window.setTimeout(() => {
                      setActiveTableId(null);
                      setActiveOrderId(null);
                      setActiveGroupId(null);
                      exitTimer.current = null;
                    }, PANEL_EXIT_MS);
                  }}
                />
              ) : activeTableId && activeTable && activeGroup ? (
                <Card className="flex h-full items-center justify-center">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div
                      className="flex size-12 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ backgroundColor: partyHex(activeGroup.color_index ?? 0) }}
                    >
                      {activeGroup.label ?? "?"}
                    </div>
                    <p className="font-medium">
                      Party {activeGroup.label ?? "?"} — {activeGroup.seats} guest
                      {activeGroup.seats === 1 ? "" : "s"}
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      No order yet for this party. Start one to add items and fire tickets.
                    </p>
                    <Button
                      onClick={() =>
                        activeTableId &&
                        ensureGroupMut.mutate({ tableId: activeTableId, groupId: activeGroup.id })
                      }
                      disabled={ensureGroupMut.isPending}
                    >
                      <Icons.add className="mr-2 size-4" /> Start order
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="flex h-full items-center justify-center">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="rounded-full border border-dashed p-3">
                      <Icons.orders className="size-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">No table selected</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Tap a table on the floor to open its bill — add items, fire tickets, split and
                      collect.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur lg:hidden">
        <div className="mx-auto grid h-14 max-w-xl grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setPanelOpen(false);
              setMobileView("tables");
            }}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium touch-manipulation",
              mobileView === "tables" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icons.table className="size-5" />
            Tables
          </button>
          <button
            type="button"
            onClick={() => activeTableId && setMobileView("order")}
            disabled={!activeTableId}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium touch-manipulation disabled:opacity-40",
              mobileView === "order" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icons.orders className="size-5" />
            Order
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeOrderId) {
                setPickerOpen(true);
                setMobileView("items");
              }
            }}
            disabled={!activeOrderId}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium touch-manipulation disabled:opacity-40",
              mobileView === "items" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icons.add className="size-5" />
            Add items
          </button>
        </div>
      </div>

      {activeOrderId && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:rounded-lg sm:p-6">
            <DialogHeader className="shrink-0">
              <DialogTitle>
                Add items{activeTable ? ` — Table ${activeTable.number}` : ""}
                {activeGroup ? ` · Party ${activeGroup.label ?? "?"}` : ""}
              </DialogTitle>
              <DialogDescription>
                Pick products below — they collect as a draft. Nothing fires to the kitchen until
                Fire to kitchen.
              </DialogDescription>
            </DialogHeader>
            <ItemPicker orderId={activeOrderId} stayOpen onClose={() => setPickerOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {activeTableDerived && (
        <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Seat a new party — Table {activeTableDerived.number}</DialogTitle>
              <DialogDescription>
                {activeTableDerived.capacity - (activeTableDerived.seated_seats ?? 0)} of{" "}
                {activeTableDerived.capacity} seats free. Each party gets its own bill.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-4 py-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSeatCount((c) => Math.max(1, c - 1))}
                disabled={seatCount <= 1}
                aria-label="Fewer guests"
              >
                <Icons.minus className="size-4" />
              </Button>
              <div className="min-w-20 text-center">
                <div className="text-3xl font-bold">{seatCount}</div>
                <div className="text-xs text-muted-foreground">
                  guest{seatCount === 1 ? "" : "s"}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setSeatCount((c) =>
                    Math.min(
                      activeTableDerived.capacity - (activeTableDerived.seated_seats ?? 0),
                      c + 1,
                    ),
                  )
                }
                disabled={
                  seatCount >= activeTableDerived.capacity - (activeTableDerived.seated_seats ?? 0)
                }
                aria-label="More guests"
              >
                <Icons.add className="size-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() =>
                activeTableId && seatMut.mutate({ tableId: activeTableId, seats: seatCount })
              }
              disabled={seatMut.isPending}
            >
              Seat party of {seatCount}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}

export function useLiveOrderId(tableId: string | null) {
  const { data } = useQuery({
    ...ordersQueryOptions({ table_id: tableId ?? "" }),
    enabled: !!tableId,
  });
  return (data ?? []).find((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")?.id ?? null;
}

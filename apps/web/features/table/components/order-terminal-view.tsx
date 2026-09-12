"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { orderKeys, ordersQueryOptions } from "@/features/orders/api/queries";
import { ensureTableOrder } from "@/features/orders/api/service";
import ItemPicker from "@/features/orders/components/item-picker";
import OrderBillPanel from "@/features/orders/components/bill-panel";
import { toast } from "sonner";

const PANEL_EXIT_MS = 300;

export default function OrderTerminalPage() {
  const queryClient = useQueryClient();
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    mutationFn: (tableId: string) => ensureTableOrder(tableId),
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
      setPanelOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Tap: select + slide panel in; tap the selected table (or floor
   * background) again to deselect and slide out. */
  const handleTap = (id: string | null) => {
    if (ensureMut.isPending) return;
    if (id == null || id === activeTableId) {
      setPickerOpen(false);
      setPanelOpen(false);
      exitTimer.current = window.setTimeout(() => {
        setActiveTableId(null);
        setActiveOrderId(null);
        exitTimer.current = null;
      }, PANEL_EXIT_MS);
      return;
    }
    ensureMut.mutate(id);
  };

  if (isLoading) {
    return (
      <PageContainer pageTitle="Order Terminal" isLoading>
        <div />
      </PageContainer>
    );
  }

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;
  const panelMounted = activeTableId != null;

  return (
    <PageContainer
      pageTitle="Order Terminal"
      pageDescription="Tap a table for its bill. Works in a separate tab — sign-in carries over."
    >
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-200px)] lg:flex-row lg:gap-6">
        <div className="h-[52dvh] min-h-[320px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <Tabs
            value={currentFloorId}
            onValueChange={(v) => {
              setSelectedFloorId(v);
              setPickerOpen(false);
            }}
            className="h-full"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 lg:mb-4 lg:flex-nowrap lg:justify-between">
              <TabsList className="max-w-full overflow-x-auto">
                {activeFloors.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="shrink-0">
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {activeTable ? (
                <Badge variant="outline" className="gap-1 border-primary text-primary">
                  <div className="h-2 w-2 rounded-full bg-primary" /> Taking order — Table {activeTable.number}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-green-500 text-green-600"
                  title="Tap a table to open its bill · tap the selected table again to deselect"
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Tap a table for bill & seating
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
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {panelMounted && (
          <div
            className={cn(
              "shrink-0 overflow-hidden transition-all duration-300 ease-out",
              // Mobile: bottom sheet sliding up from the screen edge.
              "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-2xl border-t bg-background shadow-2xl",
              // Desktop: docked side panel sliding in from the right.
              "lg:static lg:z-auto lg:max-h-none lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:w-[420px]",
              panelOpen
                ? "translate-y-0 opacity-100 lg:translate-x-0"
                : "pointer-events-none translate-y-full opacity-0 lg:translate-x-8 lg:translate-y-0 lg:w-0",
            )}
          >
            <div className="max-h-[85dvh] overflow-y-auto lg:h-full lg:max-h-none lg:w-[420px] lg:overflow-visible">
              {/* Mobile sheet grab handle + close */}
              <div className="sticky top-0 z-10 flex items-center justify-center bg-background/95 pt-2 pb-1 backdrop-blur-sm lg:hidden">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                <button
                  type="button"
                  aria-label="Close bill panel"
                  onClick={() => handleTap(null)}
                  className="absolute right-2 top-1 rounded-md p-2 text-muted-foreground"
                >
                  <Icons.close className="size-5" />
                </button>
              </div>
              {activeOrderId && activeTable ? (
                <OrderBillPanel
                  orderId={activeOrderId}
                  tableLabel={`Table ${activeTable.number}`}
                  onAddItems={() => setPickerOpen(true)}
                />
              ) : (
                <Card className="flex h-full items-center justify-center">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="rounded-full border border-dashed p-3">
                      <Icons.orders className="size-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">No table selected</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Tap a table on the floor to open its bill — add items, fire tickets, split and collect.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {activeOrderId && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Add items{activeTable ? ` — Table ${activeTable.number}` : ""}
              </DialogTitle>
              <DialogDescription>
                Pick products below. Each item fires straight to the kitchen as its own ticket.
              </DialogDescription>
            </DialogHeader>
            <ItemPicker
              orderId={activeOrderId}
              autoFire
              stayOpen
              onClose={() => setPickerOpen(false)}
            />
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

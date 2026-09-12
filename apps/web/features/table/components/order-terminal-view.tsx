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

const BLOCKED_STATES = ["out_of_service", "cleaning"] as const;
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
  const openPickerAfterEnsure = useRef(false);

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
      if (openPickerAfterEnsure.current) {
        openPickerAfterEnsure.current = false;
        setPickerOpen(true);
      }
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

  /** Long-press: ensure the order and jump straight to item picking. */
  const handleHold = (id: string) => {
    if (ensureMut.isPending) return;
    if (id === activeTableId && activeOrderId) {
      setPickerOpen(true);
      return;
    }
    openPickerAfterEnsure.current = true;
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
      pageDescription="Tap a table for its bill · hold to add items. Works in a separate tab — sign-in carries over."
    >
      <div className="flex h-[calc(100vh-200px)] flex-col gap-6 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <Tabs
            value={currentFloorId}
            onValueChange={(v) => {
              setSelectedFloorId(v);
              setPickerOpen(false);
            }}
            className="h-full"
          >
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                {activeFloors.map((f) => (
                  <TabsTrigger key={f.id} value={f.id}>
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
                  title="Single tap opens the bill panel · long-press opens item picking · tap the selected table again to deselect"
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Tap = bill · Hold = add items
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
                    onTableLongPress={handleHold}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {panelMounted && (
          <div
            className={cn(
              "min-h-0 shrink-0 overflow-hidden transition-all duration-300 ease-out lg:w-[420px]",
              panelOpen
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-8 opacity-0 max-lg:hidden lg:w-0",
            )}
          >
            <div className="h-full lg:w-[420px]">
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
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
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

export function BlockedTableNote({ tableId }: { tableId: string }) {
  const { data: table } = useQuery(tableQueryOptions(tableId));
  if (!table || !(BLOCKED_STATES as readonly string[]).includes(table.status)) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Table is {table.status.replace("_", " ")} — resolve it from the Tables view first.
    </p>
  );
}

export function useLiveOrderId(tableId: string | null) {
  const { data } = useQuery({
    ...ordersQueryOptions({ table_id: tableId ?? "" }),
    enabled: !!tableId,
  });
  return (data ?? []).find((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")?.id ?? null;
}

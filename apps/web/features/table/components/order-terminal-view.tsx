"use client";

import { Suspense, useState } from "react";
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
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { orderKeys, ordersQueryOptions } from "@/features/orders/api/queries";
import { ensureTableOrder } from "@/features/orders/api/service";
import ItemPicker from "@/features/orders/components/item-picker";
import OrderBillPanel from "@/features/orders/components/bill-panel";
import { toast } from "sonner";

const BLOCKED_STATES = ["out_of_service", "cleaning"] as const;

export default function OrderTerminalPage() {
  const queryClient = useQueryClient();
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: activeTable } = useQuery({
    ...tableQueryOptions(activeTableId ?? ""),
    enabled: !!activeTableId,
  });

  const ensureMut = useMutation({
    mutationFn: (tableId: string) => ensureTableOrder(tableId),
    onSuccess: (order, tableId) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      setActiveTableId(tableId);
      setActiveOrderId(order.id);
      setPickerOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageContainer pageTitle="Order Terminal" isLoading>
        <div />
      </PageContainer>
    );
  }

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;

  return (
    <PageContainer
      pageTitle="Order Terminal"
      pageDescription="Tap a table to capture the customer order. Works in a separate tab — sign-in carries over."
    >
      <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
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
                <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Tap a table to take order
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
                    onSelectTable={(id) => {
                      if (id && !ensureMut.isPending) ensureMut.mutate(id);
                    }}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="lg:col-span-5">
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

      {activeOrderId && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Add items{activeTable ? ` — Table ${activeTable.number}` : ""}
              </DialogTitle>
              <DialogDescription>
                Pick products below. New items build the draft ticket — fire sends it to the kitchen.
              </DialogDescription>
            </DialogHeader>
            <ItemPicker orderId={activeOrderId} onAdded={() => setPickerOpen(false)} />
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

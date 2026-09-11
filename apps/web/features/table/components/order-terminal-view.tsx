"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@pixa/ui/base-ui/tabs";
import FloorPlanCanvas from "@/features/table/components/floor-plan-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";
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
import { formatINR } from "@/lib/money";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { orderKeys, orderQueryOptions, ordersQueryOptions } from "@/features/orders/api/queries";
import { kitchenKeys } from "@/features/kitchen/api/queries";
import { ensureTableOrder } from "@/features/orders/api/service";
import { fireKOT } from "@/features/kitchen/api/service";
import ItemPicker from "@/features/orders/components/item-picker";
import { toast } from "sonner";

const BLOCKED_STATES = ["out_of_service", "cleaning"] as const;

export default function OrderTerminalPage() {
  const queryClient = useQueryClient();
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const ensureMut = useMutation({
    mutationFn: (tableId: string) => ensureTableOrder(tableId),
    onSuccess: (order, tableId) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      setActiveTableId(tableId);
      setDialogOpen(true);
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
        <div className="lg:col-span-8">
          <Tabs
            value={currentFloorId}
            onValueChange={(v) => {
              setSelectedFloorId(v);
              setDialogOpen(false);
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
              <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                <div className="h-2 w-2 rounded-full bg-green-500" /> Tap a table to take order
              </Badge>
            </div>
            {activeFloors.map((f) => (
              <TabsContent key={f.id} value={f.id} className="h-[calc(100%-60px)]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                  <FloorPlanCanvas
                    floorId={f.id}
                    mode="operations"
                    onSelectTable={(id) => {
                      if (id && !ensureMut.isPending) ensureMut.mutate(id);
                    }}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="lg:col-span-4">
          <LiveOrdersRail />
        </div>
      </div>

      {activeTableId && (
        <OrderDialog
          tableId={activeTableId}
          open={dialogOpen}
          busy={ensureMut.isPending}
          onOpenChange={setDialogOpen}
        />
      )}
    </PageContainer>
  );
}

function LiveOrdersRail() {
  const { data: orders } = useQuery(
    ordersQueryOptions({ status: undefined }),
  );
  const live = (orders ?? [])
    .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
    .slice(0, 20);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Live orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {live.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Icons.orders className="mb-2 size-8 opacity-20" />
            <p className="text-sm">No live orders. Tap a table to start one.</p>
          </div>
        ) : (
          live.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard/orders/${o.id}`}
              className="flex items-center justify-between rounded-lg border p-2 text-sm transition-colors hover:border-primary"
            >
              <span>
                <span className="font-medium">{o.order_number}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {o.table_number_snapshot ? `Table ${o.table_number_snapshot}` : o.channel.replace("_", " ")}
                  {" · "}
                  {o.items.length} item{o.items.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-medium">{formatINR(o.total_paise)}</span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function OrderDialog({
  tableId,
  open,
  busy,
  onOpenChange,
}: {
  tableId: string;
  open: boolean;
  busy: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: table } = useQuery({
    ...tableQueryOptions(tableId),
    enabled: open,
  });
  const { data: liveOrders } = useQuery({
    ...ordersQueryOptions({ table_id: tableId }),
    enabled: open,
  });
  const live = (liveOrders ?? []).find((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
  const { data: order } = useQuery({
    ...orderQueryOptions(live?.id ?? ""),
    enabled: open && !!live,
  });

  const fireMut = useMutation({
    mutationFn: () => fireKOT(live!.id),
    onSuccess: (kot) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(live!.id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: kitchenKeys.all });
      toast.success(`KOT #${kot.kot_number} fired to kitchen`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked = table && (BLOCKED_STATES as readonly string[]).includes(table.status);
  const draftCount = order?.items.filter((i) => !i.kot_id).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {table ? `Table ${table.number}` : "Table"}
            {live && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {live.order_number} · {formatINR(live.total_paise)}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {busy
              ? "Preparing the order…"
              : blocked
                ? `Table is ${table?.status.replace("_", " ")} — resolve it from the Tables view first.`
                : "Pick products below. New items build the draft ticket — fire sends it to the kitchen."}
          </DialogDescription>
        </DialogHeader>

        {!blocked && live && (
          <div className="space-y-4">
            {draftCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-2 text-sm">
                <span>
                  {draftCount} new item{draftCount === 1 ? "" : "s"} ready to fire
                </span>
                <Button size="sm" disabled={fireMut.isPending} onClick={() => fireMut.mutate()}>
                  {fireMut.isPending ? "Firing…" : "Fire to kitchen"}
                </Button>
              </div>
            )}
            <ItemPicker orderId={live.id} />
            <div className="flex justify-end gap-2">
              <Link
                href={`/dashboard/orders/${live.id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Open full order
              </Link>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

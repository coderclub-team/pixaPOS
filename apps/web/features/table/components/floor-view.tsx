"use client";

import { useState } from "react";
import PageContainer from "@/components/layout/page-container";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import { releaseOccupancy, seatOccupancy } from "@/features/table/api/service";
import { toast } from "sonner";
import { cn } from "@pixa/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@pixa/ui/base-ui/tabs";
import FloorPlanCanvas from "@/features/table/components/floor-plan-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Suspense } from "react";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import type { TableWithDerived } from "@/features/table/api/types";

function ChairRow({ capacity, seated }: { capacity: number; seated: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`${seated} of ${capacity} seats occupied`}>
      {Array.from({ length: Math.max(0, capacity) }).map((_, i) => (
        <span
          key={i}
          title={i < seated ? "Seated" : "Empty seat"}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border",
            i < seated
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
              : "border-dashed text-muted-foreground/50"
          )}
        >
          <Icons.user className="size-4" />
        </span>
      ))}
    </div>
  );
}

function TableDetailPanel({
  table,
  floorId,
}: {
  table: TableWithDerived | undefined;
  floorId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [seatOpen, setSeatOpen] = useState(false);
  const [partySize, setPartySize] = useState(2);

  const invalidate = () => {
    if (floorId) queryClient.invalidateQueries({ queryKey: floorKeys.layout(floorId) });
    queryClient.invalidateQueries({ queryKey: tableKeys.all });
    if (table) queryClient.invalidateQueries({ queryKey: tableKeys.detail(table.id) });
  };

  const seatMut = useMutation({
    mutationFn: (seats: number) =>
      seatOccupancy({ table_id: table!.id, seats, created_by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Guests seated");
      setSeatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: (groupId: string) =>
      releaseOccupancy({ group_id: groupId, released_by: "staff", reason: "Released from floor view" }),
    onSuccess: () => {
      invalidate();
      toast.success("Group released");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!table) {
    return (
      <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
        <Icons.table className="mb-2 size-8 opacity-20" />
        <p className="text-sm">Loading table…</p>
      </div>
    );
  }

  const available = Math.max(0, table.capacity - table.seated_seats);
  const orderId = table.active_groups.find((g) => g.order_id)?.order_id ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">Table Status</p>
        <p className="text-2xl font-bold">Table {table.number}</p>
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          {table.status.replace("_", " ")} • {table.seated_seats}/{table.capacity} seats
          {table.active_groups.length > 0 && ` • ${table.active_groups.length} group(s)`}
        </p>
        <div className="mt-3">
          <ChairRow capacity={table.capacity} seated={table.seated_seats} />
        </div>
      </div>

      {table.active_groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Active groups</p>
          {table.active_groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>
                {g.seats} guest{g.seats === 1 ? "" : "s"}
                {g.order_id ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    Order #{g.order_id.slice(-4)}
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-muted-foreground">No order yet</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Release group"
                onClick={() => releaseMut.mutate(g.id)}
                disabled={releaseMut.isPending}
              >
                <Icons.close className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Button
          className="w-full justify-start gap-2"
          disabled={available <= 0 || seatMut.isPending}
          onClick={() => {
            setPartySize(Math.min(2, available || 1));
            setSeatOpen(true);
          }}
        >
          <Icons.add className="size-4" /> Seat Guests
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={!orderId}
          title={orderId ? `Open order ${orderId}` : "No active order — seat guests first"}
        >
          <Icons.edit className="size-4" /> View Order
        </Button>
      </div>

      <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat guests — Table {table.number}</DialogTitle>
            <DialogDescription>
              {available} of {table.capacity} seats available.
              {!table.allows_sharing && table.active_groups.length > 0
                ? " This table does not allow sharing."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Party size</Label>
            <Input
              type="number"
              min={1}
              max={available}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSeatOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={seatMut.isPending || partySize < 1 || partySize > available}
              onClick={() => seatMut.mutate(partySize)}
            >
              Seat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FloorViewPage() {
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  // H10: resolve the real table entity — never display ID fragments as names
  const { data: selectedTable } = useQuery({
    ...tableQueryOptions(selectedTableId ?? ""),
    enabled: !!selectedTableId,
  });

  if (isLoading)
    return (
      <PageContainer pageTitle="Floor View" isLoading>
        <div />
      </PageContainer>
    );

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;

  return (
    <PageContainer
      pageTitle="Floor View"
      pageDescription="Operational view for seating management and live table status."
    >
      <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs value={currentFloorId} onValueChange={setSelectedFloorId} className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                {activeFloors.map((f) => (
                  <TabsTrigger key={f.id} value={f.id}>
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Available
                </Badge>
                <Badge variant="outline" className="gap-1 border-red-500 text-red-600">
                  <div className="h-2 w-2 rounded-full bg-red-500" /> Occupied
                </Badge>
              </div>
            </div>
            {activeFloors.map((f) => (
              <TabsContent key={f.id} value={f.id} className="h-[calc(100%-60px)]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                  <FloorPlanCanvas 
                    floorId={f.id} 
                    selectedTableId={selectedTableId ?? undefined}
                    onSelectTable={setSelectedTableId}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Table Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedTableId ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <Icons.table className="mb-2 size-8 opacity-20" />
                  <p className="text-sm">Select a table on the map to view details.</p>
                </div>
              ) : (
                <TableDetailPanel table={selectedTable} floorId={currentFloorId} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

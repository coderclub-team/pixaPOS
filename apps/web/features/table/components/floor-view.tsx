"use client";

import Link from "next/link";
import { useState } from "react";
import PageContainer from "@/components/layout/page-container";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions, tablesQueryOptions } from "@/features/table/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import {
  blockTable,
  cancelOccupancy,
  createTable,
  markCleaned,
  releaseOccupancy,
  seatOccupancy,
  transferOccupancy,
  unblockTable,
} from "@/features/table/api/service";

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
  // L6: cap rendered chips, summarize the rest
  const shown = Math.min(Math.max(0, capacity), 24);
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`${seated} of ${capacity} seats occupied`}>
      {Array.from({ length: shown }).map((_, i) => (
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
      {capacity > shown && (
        <span className="text-xs text-muted-foreground">+{capacity - shown} more</span>
      )}
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
    mutationFn: ({ groupId, reason, force }: { groupId: string; reason: string; force?: boolean }) =>
      releaseOccupancy({
        group_id: groupId,
        released_by: "staff",
        reason,
        force,
      }),
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.force ? "Group force-released" : "Group released");
      setReleaseTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [releaseTarget, setReleaseTarget] = useState<null | {
    groupId: string;
    needsForce: boolean;
  }>(null);
  const [releaseReason, setReleaseReason] = useState("");

  const transferMut = useMutation({
    mutationFn: ({ groupId, toTableId }: { groupId: string; toTableId: string }) =>
      transferOccupancy({
        group_ids: [groupId],
        to_table_id: toTableId,
        moved_by: "staff",
        reason: "Transferred from floor view",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Group transferred");
      setTransferTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [transferTarget, setTransferTarget] = useState<null | { groupId: string }>(null);
  const [transferTo, setTransferTo] = useState("");
  const { data: allTables } = useQuery(tablesQueryOptions({}));

  const markCleanedMut = useMutation({
    mutationFn: () => markCleaned({ table_id: table!.id, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table marked cleaned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockMut = useMutation({
    mutationFn: (reason: string) => blockTable({ table_id: table!.id, reason, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table blocked");
      setBlockOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: () => unblockTable({ table_id: table!.id, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table unblocked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<null | { groupId: string }>(null);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMut = useMutation({
    mutationFn: ({ groupId, reason }: { groupId: string; reason: string }) =>
      cancelOccupancy({ group_id: groupId, by: "staff", reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Occupancy cancelled");
      setCancelTarget(null);
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
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Transfer group"
                  onClick={() => {
                    setTransferTo("");
                    setTransferTarget({ groupId: g.id });
                  }}
                >
                  <Icons.share className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Release group"
                  onClick={() => {
                    setReleaseReason("");
                    setReleaseTarget({ groupId: g.id, needsForce: !!g.order_id });
                  }}
                  disabled={releaseMut.isPending}
                >
                  <Icons.close className="size-4" />
                </Button>
              </span>
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
        {table.status === "cleaning" && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={markCleanedMut.isPending}
            onClick={() => markCleanedMut.mutate()}
          >
            <Icons.check className="size-4" /> Mark cleaned
          </Button>
        )}
        {table.active_block ? (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={unblockMut.isPending}
            onClick={() => unblockMut.mutate()}
          >
            <Icons.check className="size-4" /> Unblock table
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              setBlockReason("");
              setBlockOpen(true);
            }}
          >
            <Icons.close className="size-4" /> Block table
          </Button>
        )}
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

      <Dialog open={releaseTarget != null} onOpenChange={(o) => !o && setReleaseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {releaseTarget?.needsForce ? "Force-release group?" : "Release group?"}
            </DialogTitle>
            <DialogDescription>
              {releaseTarget?.needsForce
                ? "This group has an open order. Force release frees the seats anyway and records who authorized it."
                : "Free this group's seats. The table goes to cleaning when the last group leaves."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Reason{releaseTarget?.needsForce ? " *" : ""}
            </Label>
            <Input
              placeholder="Walkout, settled at counter…"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReleaseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={releaseTarget?.needsForce ? "destructive" : "default"}
              disabled={
                releaseMut.isPending || (!!releaseTarget?.needsForce && !releaseReason.trim())
              }
              onClick={() =>
                releaseTarget &&
                releaseMut.mutate({
                  groupId: releaseTarget.groupId,
                  reason: releaseReason.trim() || "Released from floor view",
                  force: releaseTarget.needsForce,
                })
              }
            >
              Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferTarget != null} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer group</DialogTitle>
            <DialogDescription>
              Move this group to another table on this floor. Capacity and sharing are re-checked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Destination table</Label>
            <Input
              placeholder="Table id (e.g. tbl_…)"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={transferMut.isPending || !transferTo.trim()}
              onClick={() =>
                transferTarget &&
                transferMut.mutate({ groupId: transferTarget.groupId, toTableId: transferTo.trim() })
              }
            >
              Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block table {table.number}?</DialogTitle>
            <DialogDescription>
              Blocked tables cannot seat new guests. Existing groups stay until released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input
              placeholder="Broken leg, deep clean…"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={blockMut.isPending || !blockReason.trim()}
              onClick={() => blockMut.mutate(blockReason.trim())}
            >
              Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelTarget != null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel occupancy?</DialogTitle>
            <DialogDescription>
              Only for groups with no order (walkouts, no-shows). Groups with orders must be
              cancelled through the orders module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input
              placeholder="Walkout, no-show…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMut.isPending || !cancelReason.trim()}
              onClick={() =>
                cancelTarget &&
                cancelMut.mutate({ groupId: cancelTarget.groupId, reason: cancelReason.trim() })
              }
            >
              Cancel occupancy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type FloorViewMode = "edit" | "operations";

const LEGEND: { label: string; dot: string; border: string; text: string }[] = [
  { label: "Available", dot: "bg-green-500", border: "border-green-500", text: "text-green-600" },
  { label: "Occupied", dot: "bg-red-500", border: "border-red-500", text: "text-red-600" },
  { label: "Reserved", dot: "bg-amber-500", border: "border-amber-500", text: "text-amber-600" },
  { label: "Cleaning", dot: "bg-blue-500", border: "border-blue-500", text: "text-blue-600" },
  { label: "Out of service", dot: "bg-slate-500", border: "border-slate-500", text: "text-slate-600" },
  { label: "Blocked", dot: "bg-purple-500", border: "border-purple-500", text: "text-purple-600" },
];

/** Lean inspector for edit mode — identity + pose read-only, edits via the table form. */
function TableInspector({ table }: { table: TableWithDerived | undefined }) {
  if (!table) {
    return (
      <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
        <Icons.table className="mb-2 size-8 opacity-20" />
        <p className="text-sm">Select a table on the map to inspect it.</p>
      </div>
    );
  }
  const rows: [string, string][] = [
    ["Number", table.number],
    ["Code", table.code],
    ["Capacity", String(table.capacity)],
    ["Shape", table.shape],
    ["Position", `${table.x_mm}, ${table.y_mm} mm`],
    ["Size", `${table.w_mm} × ${table.h_mm} mm`],
    ["Rotation", `${table.rotation_deg ?? 0}°`],
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-bold">Table {table.number}</p>
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          {table.status.replace("_", " ")} • {table.seated_seats}/{table.capacity} seats
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-xs">{v}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={`/dashboard/settings/outlet/tables/${table.id}`}
        className="inline-flex w-full items-center justify-start gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <Icons.edit className="size-4" /> Edit in table form
      </Link>
      <p className="text-xs text-muted-foreground">
        Move, resize, and rotate on the canvas — size and position save when you release the drag.
      </p>
    </div>
  );
}

export default function FloorViewPage({ mode = "operations" }: { mode?: FloorViewMode }) {
  const queryClient = useQueryClient();
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  // H10: resolve the real table entity — never display ID fragments as names
  const { data: selectedTable } = useQuery({
    ...tableQueryOptions(selectedTableId ?? ""),
    enabled: !!selectedTableId,
  });

  const addTableMut = useMutation({
    mutationFn: async (floorId: string) => {
      const existing = await queryClient.ensureQueryData(tablesQueryOptions({ floor_id: floorId }));
      const n = existing.length + 1;
      return createTable({
        outlet_id: "out_001",
        floor_id: floorId,
        number: `T${n}`,
        code: `T${n}`,
        capacity: 4,
        shape: "square",
        is_active: true,
      } as never);
    },
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: tableKeys.all });
      queryClient.invalidateQueries({ queryKey: floorKeys.layout(t.floor_id) });
      setSelectedTableId(t.id);
      toast.success(`Table ${t.number} added — drag it into place`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <PageContainer pageTitle={mode === "edit" ? "Floor Plan Editor" : "Floor View"} isLoading>
        <div />
      </PageContainer>
    );

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;

  return (
    <PageContainer
      pageTitle={mode === "edit" ? "Floor Plan Editor" : "Floor View"}
      pageDescription={
        mode === "edit"
          ? "Arrange tables and floor objects. For daily seating use the operations view."
          : "Operational view for seating management and live table status."
      }
    >
      {mode === "edit" && (
        <div className="mb-4">
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
            <div className="h-2 w-2 rounded-full bg-amber-500" /> Layout editor — not for daily
            seating
          </Badge>
        </div>
      )}
      <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs
            value={currentFloorId}
            // M5: clear the selection when the operator changes floors
            onValueChange={(v) => {
              setSelectedFloorId(v);
              setSelectedTableId(null);
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
              <div className="flex flex-wrap gap-2">
                {LEGEND.map((l) => (
                  <Badge key={l.label} variant="outline" className={`gap-1 ${l.border} ${l.text}`}>
                    <div className={`h-2 w-2 rounded-full ${l.dot}`} /> {l.label}
                  </Badge>
                ))}
              </div>
            </div>
            {activeFloors.map((f) => (
              <TabsContent key={f.id} value={f.id} className="h-[calc(100%-60px)]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                  <FloorPlanCanvas
                    floorId={f.id}
                    mode={mode}
                    selectedTableId={selectedTableId ?? undefined}
                    onSelectTable={setSelectedTableId}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
          {mode === "edit" && currentFloorId && (
            <div className="mt-3">
              <Button
                variant="outline"
                className="gap-2"
                disabled={addTableMut.isPending}
                onClick={() => addTableMut.mutate(currentFloorId)}
              >
                <Icons.add className="size-4" /> Add table to this floor
              </Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">
                {mode === "edit" ? "Table Inspector" : "Table Detail"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedTableId ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <Icons.table className="mb-2 size-8 opacity-20" />
                  <p className="text-sm">Select a table on the map to view details.</p>
                </div>
              ) : mode === "edit" ? (
                <TableInspector table={selectedTable} />
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

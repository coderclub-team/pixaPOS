"use client";

import Link from "next/link";
import { useState } from "react";
import PageContainer from "@/components/layout/page-container";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableKeys, tableQueryOptions, tablesQueryOptions } from "@/features/table/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import { createTable } from "@/features/table/api/service";
import TableStrip from "@/features/table/components/table-strip";
import TableOpsDialog from "@/features/table/components/table-ops-dialog";

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
import type { TableWithDerived } from "@/features/table/api/types";

function ChairRow({ capacity, seated }: { capacity: number; seated: number }) {
  // L6: cap rendered chips, summarize the rest
  const shown = Math.min(Math.max(0, capacity), 24);
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label={`${seated} of ${capacity} seats occupied`}
    >
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          title={i < seated ? "Seated" : "Empty seat"}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border",
            i < seated
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
              : "border-dashed text-muted-foreground/50",
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
  const router = useRouter();
  const [opsOpen, setOpsOpen] = useState(false);

  if (!table) {
    return (
      <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
        <Icons.table className="mb-2 size-8 opacity-20" />
        <p className="text-sm">Loading table…</p>
      </div>
    );
  }

  const orderId = table.active_groups.find((g) => g.order_id)?.order_id ?? null;

  return (
    <div className="space-y-4">
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

      <TableStrip table={table} onOpenOps={() => setOpsOpen(true)} />

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={!orderId}
          title={orderId ? `Open order ${orderId}` : "No active order — seat guests first"}
          onClick={() => orderId && router.push(`/dashboard/orders/${orderId}`)}
        >
          <Icons.edit className="mr-2 h-4 w-4" /> View Order
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setOpsOpen(true)}
        >
          <Icons.party className="mr-2 h-4 w-4" /> Table ops — parties, block, status
        </Button>
      </div>

      <TableOpsDialog
        tableId={table.id}
        floorId={floorId}
        open={opsOpen}
        onOpenChange={setOpsOpen}
        onOpenOrder={(id) => router.push(`/dashboard/orders/${id}`)}
      />
    </div>
  );
}

export type FloorViewMode = "edit" | "operations";

const LEGEND: { label: string; dot: string; border: string; text: string }[] = [
  { label: "Available", dot: "bg-green-500", border: "border-green-500", text: "text-green-600" },
  { label: "Occupied", dot: "bg-red-500", border: "border-red-500", text: "text-red-600" },
  { label: "Reserved", dot: "bg-amber-500", border: "border-amber-500", text: "text-amber-600" },
  { label: "Cleaning", dot: "bg-blue-500", border: "border-blue-500", text: "text-blue-600" },
  {
    label: "Out of service",
    dot: "bg-slate-500",
    border: "border-slate-500",
    text: "text-slate-600",
  },
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
                    // Ops floor: tapping a party chip focuses its table so the
                    // detail panel shows that party's rows. Hold-to-order lives
                    // in the order terminal, which passes onHoldParty.
                    onSelectParty={
                      mode === "operations" ? (tableId) => setSelectedTableId(tableId) : undefined
                    }
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

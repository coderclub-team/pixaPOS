"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pixa/ui/base-ui/dialog";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { toast } from "sonner";
import { SortTh, useSorting } from "@/components/sort-th";
import { ExportButton } from "@/features/system/components/io-dialog";
import type { CsvColumn } from "@/features/system/lib/csv";
import {
  batchesQueryOptions,
  inventoryKeys,
  locationsQueryOptions,
} from "@/features/inventory/api/queries";
import { updateBatch } from "@/features/inventory/api/service";
import type { StockBatch } from "@/features/inventory/api/types";

const columns: CsvColumn<StockBatch>[] = [
  { key: "batch", label: "Batch No", get: (b) => b.batch_no },
  { key: "material", label: "Material", get: (b) => b.material_name ?? "" },
  { key: "mfg", label: "Mfg Date", get: (b) => b.mfg_date ?? "" },
  { key: "expiry", label: "Expiry", get: (b) => b.expiry_date ?? "" },
  { key: "received", label: "Received", get: (b) => b.qty_received },
  { key: "onhand", label: "On Hand", get: (b) => b.qty_on_hand },
  { key: "location", label: "Location", get: (b) => b.location_name ?? "" },
  { key: "status", label: "Status", get: (b) => b.status },
];

function expiryTone(b: StockBatch): string {
  if (b.status === "expired") return "text-destructive font-semibold";
  if (!b.expiry_date) return "text-muted-foreground";
  const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
  if (days <= 7) return "text-destructive font-semibold";
  if (days <= 30) return "text-amber-600 dark:text-amber-400 font-medium";
  return "";
}

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<StockBatch | null>(null);

  // Debounced search mirrors other inventory pages.
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (v: string) => {
    setInputValue(v);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => setSearch(v), 300));
  };

  const { data: locations } = useQuery(locationsQueryOptions());
  const { data: batches, isPending } = useQuery(
    batchesQueryOptions({
      search: search || undefined,
      location_id: locationId,
      expiring_within_days: filter === "expiring" ? 30 : undefined,
      expired: filter === "expired" ? true : undefined,
    }),
  );

  const { sortKey, sortDir, toggle, sorted } = useSorting<StockBatch>("expiry");
  const rows = sorted(batches ?? [], {
    batch: (b) => b.batch_no,
    material: (b) => b.material_name ?? "",
    expiry: (b) => b.expiry_date ?? "9999",
    onhand: (b) => b.qty_on_hand,
    location: (b) => b.location_name ?? "",
    status: (b) => b.status,
  });

  if (isPending)
    return (
      <PageContainer pageTitle="Batches" pageDescription="Inventory — Batches" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Batches"
      pageDescription="Goods lots: badge numbers, mfg/expiry, floor + rack. FEFO auto-picks earliest expiry."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search batch or material…"
          value={inputValue}
          onChange={(e) => onSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Expiry filter">
          {(["all", "expiring", "expired"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs capitalize"
              onClick={() => setFilter(f)}
              title={
                f === "all"
                  ? "All batches"
                  : f === "expiring"
                    ? "Expires within 30 days"
                    : "Already expired with stock"
              }
            >
              {f === "expiring" ? "Expiring ≤30d" : f}
            </Button>
          ))}
        </div>
        <Select
          value={locationId ?? "all"}
          onValueChange={(v) => setLocationId(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {(locations ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto">
          <ExportButton filename="stock-batches" rows={rows} columns={columns} />
        </span>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortTh
                    label="Batch"
                    column="batch"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Material"
                    column="material"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>Mfg</TableHead>
                <TableHead>
                  <SortTh
                    label="Expiry"
                    column="expiry"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh
                    label="On hand"
                    column="onhand"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                    className="ml-auto"
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Location"
                    column="location"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Status"
                    column="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                      {b.batch_no}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{b.material_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {b.mfg_date ?? "—"}
                  </TableCell>
                  <TableCell className={`text-xs ${expiryTone(b)}`}>
                    {b.expiry_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{b.qty_on_hand}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {b.location_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{b.status}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No batches match — receipts create batches automatically.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && (
        <BatchEditDialog
          batch={editing}
          locations={locations ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
            setEditing(null);
          }}
        />
      )}
    </PageContainer>
  );
}

function BatchEditDialog({
  batch,
  locations,
  onClose,
  onSaved,
}: {
  batch: StockBatch;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mfg, setMfg] = useState(batch.mfg_date ?? "");
  const [expiry, setExpiry] = useState(batch.expiry_date ?? "");
  const [loc, setLoc] = useState(batch.location_id ?? "");
  const mut = useMutation({
    mutationFn: () =>
      updateBatch(batch.id, {
        mfg_date: mfg || undefined,
        expiry_date: expiry || undefined,
        location_id: loc || undefined,
      }),
    onSuccess: () => {
      toast.success(`Batch ${batch.batch_no} updated`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch {batch.batch_no}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mfg date</Label>
            <Input type="date" value={mfg} onChange={(e) => setMfg(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Select value={loc || "none"} onValueChange={(v) => setLoc(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Save batch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

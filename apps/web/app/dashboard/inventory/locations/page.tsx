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
import { Switch } from "@pixa/ui/base-ui/switch";
import { Icons } from "@pixa/ui/icons";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { toast } from "sonner";
import { SortTh, useSorting } from "@/components/sort-th";
import { inventoryKeys, locationsQueryOptions } from "@/features/inventory/api/queries";
import { createStorageLocation, updateStorageLocation } from "@/features/inventory/api/service";
import type { StorageLocation } from "@/features/inventory/api/types";

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { data: locations, isPending } = useQuery(locationsQueryOptions());
  const [editing, setEditing] = useState<StorageLocation | "new" | null>(null);
  const { sortKey, sortDir, toggle, sorted } = useSorting<StorageLocation>("name");
  const rows = sorted(locations ?? [], {
    name: (l) => l.name,
    floor: (l) => l.floor ?? "",
    rack: (l) => l.rack ?? "",
    status: (l) => l.is_active,
  });

  if (isPending)
    return (
      <PageContainer pageTitle="Locations" pageDescription="Inventory — Locations" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Locations"
      pageDescription="Storage master — floor and rack per goods location."
      pageHeaderAction={
        <Button className="text-xs md:text-sm" onClick={() => setEditing("new")}>
          <Icons.add className="mr-2 h-4 w-4" /> Add location
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortTh
                    label="Location"
                    column="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Floor"
                    column="floor"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Rack"
                    column="rack"
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
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.floor ?? "—"}</TableCell>
                  <TableCell>
                    {l.rack ? (
                      <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {l.rack}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusDot isActive={l.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(l)}>
                      <Icons.edit className="mr-1 size-3.5" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && (
        <LocationDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? undefined : editing}
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

function LocationDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: StorageLocation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [rack, setRack] = useState(initial?.rack ?? "");
  const [active, setActive] = useState(initial?.is_active ?? true);
  const mut = useMutation({
    mutationFn: () =>
      initial
        ? updateStorageLocation(initial.id, {
            name,
            floor: floor.trim() || undefined,
            rack: rack.trim() || undefined,
            is_active: active,
          })
        : createStorageLocation({
            name,
            floor: floor.trim() || undefined,
            rack: rack.trim() || undefined,
            is_active: active,
          }),
    onSuccess: () => {
      toast.success(initial ? "Location updated" : "Location created");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New location"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main Store"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Floor</Label>
              <Input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="Ground"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rack</Label>
              <Input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="A1" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mut.isPending || !name.trim()} onClick={() => mut.mutate()}>
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

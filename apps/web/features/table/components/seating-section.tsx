"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { tableKeys } from "@/features/table/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import {
  blockTable,
  cancelOccupancy,
  markCleaned,
  releaseOccupancy,
  seatOccupancy,
  setTableStatus,
  transferOccupancy,
  unblockTable,
} from "@/features/table/api/service";
import { TABLE_TRANSITIONS } from "@/features/table/api/utils";
import type { TableStatus, TableWithDerived } from "@/features/table/api/types";
import { toast } from "sonner";

const STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
  out_of_service: "Out of service",
};

/**
 * Embeddable seating + table-status section for the order terminal bill
 * panel. Same service commands as the Tables-view detail panel; adds direct
 * status set (reason-audited, map-constrained) and wires the cancel-occupancy
 * dialog to order-less groups.
 */
export default function SeatingSection({
  table,
  floorId,
  defaultOpen,
}: {
  table: TableWithDerived;
  floorId: string | undefined;
  defaultOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen ?? table.active_groups.length === 0);
  const [seatOpen, setSeatOpen] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [releaseTarget, setReleaseTarget] = useState<null | { groupId: string; needsForce: boolean }>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [transferTarget, setTransferTarget] = useState<null | { groupId: string }>(null);
  const [transferTo, setTransferTo] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<null | { groupId: string }>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTo, setStatusTo] = useState<TableStatus | "">("");
  const [statusReason, setStatusReason] = useState("");

  const invalidate = () => {
    if (floorId) queryClient.invalidateQueries({ queryKey: floorKeys.layout(floorId) });
    queryClient.invalidateQueries({ queryKey: tableKeys.all });
    queryClient.invalidateQueries({ queryKey: tableKeys.detail(table.id) });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const seatMut = useMutation({
    mutationFn: (seats: number) => seatOccupancy({ table_id: table.id, seats, created_by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Guests seated");
      setSeatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const releaseMut = useMutation({
    mutationFn: ({ groupId, reason, force }: { groupId: string; reason: string; force?: boolean }) =>
      releaseOccupancy({ group_id: groupId, released_by: "staff", reason, force }),
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.force ? "Group force-released" : "Group released");
      setReleaseTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const transferMut = useMutation({
    mutationFn: ({ groupId, toTableId }: { groupId: string; toTableId: string }) =>
      transferOccupancy({ group_ids: [groupId], to_table_id: toTableId, moved_by: "staff", reason: "Transferred from terminal" }),
    onSuccess: () => {
      invalidate();
      toast.success("Group transferred");
      setTransferTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
  const markCleanedMut = useMutation({
    mutationFn: () => markCleaned({ table_id: table.id, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table marked cleaned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const blockMut = useMutation({
    mutationFn: (reason: string) => blockTable({ table_id: table.id, reason, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table blocked");
      setBlockOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unblockMut = useMutation({
    mutationFn: () => unblockTable({ table_id: table.id, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table unblocked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ to, reason }: { to: TableStatus; reason: string }) =>
      setTableStatus({ table_id: table.id, to, reason, by: "staff" }),
    onSuccess: (t) => {
      invalidate();
      toast.success(`Table is now ${STATUS_LABEL[t.status]}`);
      setStatusOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = Math.max(0, table.capacity - table.seated_seats);
  const nextStates = TABLE_TRANSITIONS[table.status];

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-sm"
      >
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Seating · {table.seated_seats}/{table.capacity}
          {table.active_block ? " · blocked" : ""}
        </span>
        <Icons.chevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="space-y-2 border-t px-2 py-2">
          <p className="text-xs capitalize text-muted-foreground">
            {table.status.replace("_", " ")}
            {table.active_block ? ` · blocked (${table.active_block.reason})` : ""}
            {table.active_hold ? ` · held for ${table.active_hold.holder_name}` : ""}
          </p>

          {table.active_groups.length > 0 && (
            <div className="space-y-1">
              {table.active_groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                  <span>
                    {g.seats} guest{g.seats === 1 ? "" : "s"}
                    {g.order_id ? (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        Order #{g.order_id.slice(-4)}
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] text-muted-foreground">No order yet</span>
                    )}
                  </span>
                  <span className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="max-lg:h-9 max-lg:w-9"
                      title="Transfer group"
                      onClick={() => {
                        setTransferTo("");
                        setTransferTarget({ groupId: g.id });
                      }}
                    >
                      <Icons.share className="size-4" />
                    </Button>
                    {!g.order_id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="max-lg:h-9 max-lg:w-9"
                        title="Cancel occupancy (no order)"
                        onClick={() => {
                          setCancelReason("");
                          setCancelTarget({ groupId: g.id });
                        }}
                      >
                        <Icons.close className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="max-lg:h-9 max-lg:w-9"
                      title={g.order_id ? "Release group (has open order)" : "Release group"}
                      disabled={releaseMut.isPending}
                      onClick={() => {
                        setReleaseReason("");
                        setReleaseTarget({ groupId: g.id, needsForce: !!g.order_id });
                      }}
                    >
                      <Icons.logout className="size-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              disabled={available <= 0 || seatMut.isPending}
              onClick={() => {
                setPartySize(Math.min(2, available || 1));
                setSeatOpen(true);
              }}
            >
              <Icons.add className="mr-1 size-4" /> Seat
            </Button>
            {table.status === "cleaning" && (
              <Button size="sm" variant="outline" disabled={markCleanedMut.isPending} onClick={() => markCleanedMut.mutate()}>
                <Icons.check className="mr-1 size-4" /> Cleaned
              </Button>
            )}
            {table.active_block ? (
              <Button size="sm" variant="outline" disabled={unblockMut.isPending} onClick={() => unblockMut.mutate()}>
                Unblock
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBlockReason("");
                  setBlockOpen(true);
                }}
              >
                Block
              </Button>
            )}
            {nextStates.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatusTo("");
                  setStatusReason("");
                  setStatusOpen(true);
                }}
              >
                Set status
              </Button>
            )}
          </div>

          {table.status === "out_of_service" && (
            <p className="text-[11px] text-muted-foreground">
              Out of service — use Set status to bring it back to available.
            </p>
          )}
          {table.status === "cleaning" && (
            <p className="text-[11px] text-muted-foreground">
              Cleaning — mark cleaned before seating.
            </p>
          )}
        </div>
      )}

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
            <DialogTitle>{releaseTarget?.needsForce ? "Force-release group?" : "Release group?"}</DialogTitle>
            <DialogDescription>
              {releaseTarget?.needsForce
                ? "This group has an open order. Force release frees the seats anyway and records who authorized it — the order locks for edits."
                : "Free this group's seats. The table goes to cleaning when the last group leaves."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason{releaseTarget?.needsForce ? " *" : ""}</Label>
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
              disabled={releaseMut.isPending || (!!releaseTarget?.needsForce && !releaseReason.trim())}
              onClick={() =>
                releaseTarget &&
                releaseMut.mutate({
                  groupId: releaseTarget.groupId,
                  reason: releaseReason.trim() || "Released from terminal",
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
              Move this group to another table. Capacity and sharing are re-checked.
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

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set table status — Table {table.number}</DialogTitle>
            <DialogDescription>
              Currently {STATUS_LABEL[table.status]}. Only legal next states are offered.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {nextStates.map((s) => (
              <Button
                key={s}
                type="button"
                variant={statusTo === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusTo(s)}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason *</Label>
            <Input
              placeholder="Why is the status changing…"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={statusMut.isPending || !statusTo || !statusReason.trim()}
              onClick={() => statusTo && statusMut.mutate({ to: statusTo, reason: statusReason.trim() })}
            >
              Set status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

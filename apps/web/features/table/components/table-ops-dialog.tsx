"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { tableKeys, tableQueryOptions } from "@/features/table/api/queries";
import { floorKeys, floorLayoutQueryOptions } from "@/features/floor/api/queries";
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
import { TABLE_TRANSITIONS, partyHex } from "@/features/table/api/utils";
import type { TableStatus } from "@/features/table/api/types";
import { toast } from "sonner";

const STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
  out_of_service: "Out of service",
};

/**
 * Shared table-operations dialog. Loosely coupled: takes only IDs, resolves
 * its own derived table, owns every mutation. Used by the terminal bill
 * panel, the order workspace, and the ops floor detail panel — one ops
 * surface everywhere instead of three inline copies.
 *
 * Sections: Parties (per-group transfer/release/cancel + de-emphasized seat)
 * and Table (status, block, cleaned). Destructive or guarded actions keep
 * their confirm dialogs inside.
 */
export default function TableOpsDialog({
  tableId,
  floorId,
  open,
  onOpenChange,
  onOpenOrder,
}: {
  tableId: string;
  floorId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: table } = useQuery({ ...tableQueryOptions(tableId), enabled: open });
  const { data: layout } = useQuery({
    ...floorLayoutQueryOptions(floorId ?? ""),
    enabled: open && !!floorId,
  });

  const [seatOpen, setSeatOpen] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [releaseTarget, setReleaseTarget] = useState<null | {
    groupId: string;
    needsForce: boolean;
  }>(null);
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
    queryClient.invalidateQueries({ queryKey: tableKeys.detail(tableId) });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const seatMut = useMutation({
    mutationFn: (seats: number) => seatOccupancy({ table_id: tableId, seats, created_by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Guests seated");
      setSeatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const releaseMut = useMutation({
    mutationFn: ({
      groupId,
      reason,
      force,
    }: {
      groupId: string;
      reason: string;
      force?: boolean;
    }) => releaseOccupancy({ group_id: groupId, released_by: "staff", reason, force }),
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.force ? "Group force-released" : "Group released");
      setReleaseTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const transferMut = useMutation({
    mutationFn: ({ groupId, toTableId }: { groupId: string; toTableId: string }) =>
      transferOccupancy({
        group_ids: [groupId],
        to_table_id: toTableId,
        moved_by: "staff",
        reason: "Transferred from table ops",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Group transferred");
      setTransferTarget(null);
      setTransferTo("");
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
    mutationFn: () => markCleaned({ table_id: tableId, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table marked cleaned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const blockMut = useMutation({
    mutationFn: (reason: string) => blockTable({ table_id: tableId, reason, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table blocked");
      setBlockOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unblockMut = useMutation({
    mutationFn: () => unblockTable({ table_id: tableId, by: "staff" }),
    onSuccess: () => {
      invalidate();
      toast.success("Table unblocked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ to, reason }: { to: TableStatus; reason: string }) =>
      setTableStatus({ table_id: tableId, to, reason, by: "staff" }),
    onSuccess: (t) => {
      invalidate();
      toast.success(`Table is now ${STATUS_LABEL[t.status]}`);
      setStatusOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = table ? Math.max(0, table.capacity - table.seated_seats) : 0;
  const nextStates = table ? TABLE_TRANSITIONS[table.status] : [];
  const destinations = (layout?.tables ?? [])
    .filter((t) => t.id !== tableId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{table ? `Table ${table.number} · ops` : "Table ops"}</DialogTitle>
            <DialogDescription>
              {table
                ? `${STATUS_LABEL[table.status]} · ${table.seated_seats}/${table.capacity} seated${table.active_block ? ` · blocked (${table.active_block.reason})` : ""}${table.active_hold ? ` · held for ${table.active_hold.holder_name}` : ""}`
                : "Loading table…"}
            </DialogDescription>
          </DialogHeader>

          {table && (
            <div className="space-y-5">
              <section className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Parties{table.active_groups.length > 0 && ` · ${table.active_groups.length}`}
                </p>
                {table.active_groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No parties seated.</p>
                ) : (
                  table.active_groups.map((g, i) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: partyHex(g.color_index ?? i) }}
                        >
                          {g.label ?? "?"}
                        </span>
                        <span className="truncate">
                          {g.seats} guest{g.seats === 1 ? "" : "s"}
                          {g.order_id && onOpenOrder ? (
                            <button
                              type="button"
                              onClick={() => g.order_id && onOpenOrder(g.order_id)}
                              className="ml-2 font-mono text-[11px] text-primary underline-offset-2 hover:underline"
                            >
                              Order #{g.order_id.slice(-4)}
                            </button>
                          ) : (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {g.order_id ? `Order #${g.order_id.slice(-4)}` : "No order yet"}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:h-9 max-lg:w-9"
                          title="Transfer party"
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
                          title={g.order_id ? "Release party (has open order)" : "Release party"}
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
                  ))
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={available <= 0 || seatMut.isPending}
                  onClick={() => {
                    setPartySize(Math.min(2, available || 1));
                    setSeatOpen(true);
                  }}
                >
                  <Icons.add className="mr-1 size-4" /> Seat new party
                </Button>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Table</p>
                <div className="flex flex-wrap gap-1.5">
                  {table.status === "cleaning" && (
                    <Button
                      size="sm"
                      disabled={markCleanedMut.isPending}
                      onClick={() => markCleanedMut.mutate()}
                    >
                      <Icons.check className="mr-1 size-4" /> Cleaned
                    </Button>
                  )}
                  {table.active_block ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unblockMut.isPending}
                      onClick={() => unblockMut.mutate()}
                    >
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
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat guests{table ? ` — Table ${table.number}` : ""}</DialogTitle>
            <DialogDescription>
              {available} of {table?.capacity ?? 0} seats available.
              {table && !table.allows_sharing && table.active_groups.length > 0
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
              {releaseTarget?.needsForce ? "Force-release party?" : "Release party?"}
            </DialogTitle>
            <DialogDescription>
              {releaseTarget?.needsForce
                ? "This party has an open order. Force release frees the seats anyway and records who authorized it — the order locks for edits."
                : "Free this party's seats. The table goes to cleaning when the last party leaves."}
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
                  reason: releaseReason.trim() || "Released from table ops",
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
            <DialogTitle>Transfer party</DialogTitle>
            <DialogDescription>
              Move this party to another table on this floor. Capacity and sharing are re-checked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Destination table</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a table…" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} · {t.seated_seats}/{t.capacity} seated
                    {t.allows_sharing ? " · shared" : ""}
                    {t.status !== "available" && t.status !== "occupied"
                      ? ` · ${t.status.replace("_", " ")}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={transferMut.isPending || !transferTo}
              onClick={() =>
                transferTarget &&
                transferMut.mutate({ groupId: transferTarget.groupId, toTableId: transferTo })
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
              Only for parties with no order (walkouts, no-shows). Parties with orders must be
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
            <DialogTitle>Block table{table ? ` ${table.number}` : ""}?</DialogTitle>
            <DialogDescription>
              Blocked tables cannot seat new guests. Existing parties stay until released.
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
            <DialogTitle>Set table status{table ? ` — Table ${table.number}` : ""}</DialogTitle>
            <DialogDescription>
              Currently {table ? STATUS_LABEL[table.status] : "…"}. Only legal next states are
              offered.
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
              onClick={() =>
                statusTo && statusMut.mutate({ to: statusTo, reason: statusReason.trim() })
              }
            >
              Set status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

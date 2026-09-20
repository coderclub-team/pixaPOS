"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
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
import { kitchenKeys, kitchenTicketsQueryOptions } from "@/features/kitchen/api/queries";
import {
  acceptKOT,
  acceptKOTLine,
  markLineReady,
  serveKOT,
  startPreparingKOT,
  startPreparingKOTLine,
  voidKOT,
  voidKOTLine,
} from "@/features/kitchen/api/service";
import type { KitchenTicketWithDerived, KOTStatus } from "@/features/kitchen/api/types";
import { getQueryClient } from "@/lib/query-client";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";
import { useKitchenFeed } from "@/features/kitchen/api/use-kitchen-feed";
import { toast } from "sonner";

type BoardFilter = KOTStatus | "ALL";
type BoardView = "kanban" | "cards";

const VIEW_STORAGE_KEY = "pixa-kitchen-view";

const TABS: { status: BoardFilter; label: string }[] = [
  { status: "ALL", label: "Live" },
  { status: "NEW", label: "New" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready" },
];

/** Lifecycle order for kanban columns (terminal states last). */
const STATUS_ORDER: KOTStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"];
const LIVE_STATUSES: KOTStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY"];

const COLUMN_LABEL: Record<KOTStatus, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  CANCELLED: "Voided",
};

/**
 * Shared KDS board — rendered by the dashboard kitchen page and the
 * standalone /kds wallboard. `compact` tightens spacing so more tickets fit
 * on wall displays.
 */
export default function KdsBoard({ compact = false }: { compact?: boolean }) {
  useCrossTabSync();
  const feed = useKitchenFeed();
  const [filter, setFilter] = useState<BoardFilter>("ALL");
  const [view, setViewState] = useState<BoardView>(() => {
    if (typeof window === "undefined") return "kanban";
    try {
      return window.localStorage.getItem(VIEW_STORAGE_KEY) === "cards" ? "cards" : "kanban";
    } catch {
      return "kanban";
    }
  });
  const setView = (v: BoardView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {}
  };

  // Fetch all tickets; tabs filter client-side so counts and
  // tab switches are instant. The board is live across dates — an open
  // ticket stays visible until served, whenever it was fired. Live SSE feed
  // (useKitchenFeed) pushes invalidations; the poll below is the offline
  // fallback and slows down while the stream is healthy.
  const {
    data: tickets,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    ...kitchenTicketsQueryOptions({}),
    refetchInterval: feed === "live" ? 30000 : 5000,
    retry: 2,
    placeholderData: (prev) => prev,
  });

  if (isError) {
    console.error("[kds-board] tickets query failed:", error);
  }

  const live = (tickets ?? []).filter((t) => t.status !== "SERVED" && t.status !== "CANCELLED");
  const scoped = live.filter((t) => filter === "ALL" || t.status === filter);
  const countFor = (s: BoardFilter) =>
    s === "ALL" ? live.length : live.filter((t) => t.status === s).length;

  // Kanban columns: the selected statuses; always hold all four live
  // columns (empty ones keep a placeholder for spatial stability).
  const wanted: KOTStatus[] = filter === "ALL" ? STATUS_ORDER : [filter as KOTStatus];
  const columnStatuses = wanted.filter(
    (s) => scoped.some((t) => t.status === s) || LIVE_STATUSES.includes(s),
  );

  if (isPending && !tickets) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading tickets…</p>;
  }

  if (isError && !tickets) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
        <p className="font-medium">Couldn&apos;t load tickets</p>
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Unknown error"} — your fired tickets are safe in local
          storage.
        </p>
        <Button size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(compact && "text-[15px]")}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1" role="group" aria-label="Board view">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            aria-pressed={view === "kanban"}
            title="Kanban view"
            onClick={() => setView("kanban")}
          >
            <Icons.kanban className="size-4" />
          </Button>
          <Button
            variant={view === "cards" ? "default" : "outline"}
            size="sm"
            aria-pressed={view === "cards"}
            title="Card view"
            onClick={() => setView("cards")}
          >
            <Icons.cards className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => getQueryClient().invalidateQueries({ queryKey: kitchenKeys.all })}
        >
          Refresh board
        </Button>
        <span
          title={feed === "live" ? "Live stream connected" : "Polling fallback"}
          className="flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <span
            className={
              feed === "live"
                ? "size-1.5 rounded-full bg-emerald-500"
                : "size-1.5 rounded-full bg-zinc-400"
            }
          />
          {feed === "live" ? "Live" : "Polling"}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TABS.map((c) => (
          <Button
            key={c.status}
            variant={filter === c.status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(c.status)}
          >
            {c.label} · {countFor(c.status)}
          </Button>
        ))}
      </div>
      {scoped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="rounded-full border border-dashed p-3">
                <Icons.kitchen className="size-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No live tickets</p>
              <p className="text-sm text-muted-foreground">
                Fired KOTs from orders appear here in real time.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          {columnStatuses.map((s) => {
            const col = scoped.filter((t) => t.status === s);
            return (
              <div
                key={s}
                className={cn("shrink-0 space-y-2", compact ? "w-[260px]" : "w-[300px]")}
              >
                <p className="px-1 text-xs font-medium uppercase text-muted-foreground">
                  {COLUMN_LABEL[s]} · {col.length}
                </p>
                {col.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
                    No tickets
                  </div>
                ) : (
                  col.map((t) => <TicketCard key={t.id} ticket={t} compact={compact} />)
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scoped.map((t) => (
            <TicketCard key={t.id} ticket={t} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function invalidateBoard() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: kitchenKeys.all });
  qc.invalidateQueries({ queryKey: ["orders"] });
}

function TicketCard({
  ticket: t,
  compact = false,
}: {
  ticket: KitchenTicketWithDerived;
  compact?: boolean;
}) {
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [lineVoid, setLineVoid] = useState<{ lineId: string; name: string; max: number } | null>(
    null,
  );
  const [lineVoidQty, setLineVoidQty] = useState(1);
  const [lineVoidReason, setLineVoidReason] = useState("");

  const onOk = (msg: string) => () => {
    invalidateBoard();
    toast.success(msg);
  };
  const onErr = (e: Error) => toast.error(e.message);
  const acceptMut = useMutation({
    mutationFn: () => acceptKOT(t.id),
    onSuccess: onOk(`KOT #${t.kot_number} accepted`),
    onError: onErr,
  });
  const prepMut = useMutation({
    mutationFn: () => startPreparingKOT(t.id),
    onSuccess: onOk(`KOT #${t.kot_number} preparing`),
    onError: onErr,
  });
  const serveMut = useMutation({
    mutationFn: () => serveKOT(t.id),
    onSuccess: onOk(`KOT #${t.kot_number} served`),
    onError: onErr,
  });
  const lineMut = useMutation({
    mutationFn: (lineId: string) => markLineReady(t.id, lineId),
    onSuccess: onOk("Item marked ready"),
    onError: onErr,
  });
  const startLineMut = useMutation({
    mutationFn: (lineId: string) => startPreparingKOTLine(t.id, lineId),
    onSuccess: onOk("Item preparing"),
    onError: onErr,
  });
  const acceptLineMut = useMutation({
    mutationFn: (lineId: string) => acceptKOTLine(t.id, lineId),
    onSuccess: onOk("Item accepted"),
    onError: onErr,
  });
  const voidLineMut = useMutation({
    mutationFn: ({ lineId, qty, r }: { lineId: string; qty: number; r: string }) =>
      voidKOTLine(t.id, lineId, { qty, reason: r }),
    onSuccess: () => {
      invalidateBoard();
      toast.success("Item void recorded");
      setLineVoid(null);
      setLineVoidReason("");
    },
    onError: onErr,
  });
  const voidMut = useMutation({
    mutationFn: (r: string) => voidKOT(t.id, { reason: r }),
    onSuccess: onOk("KOT voided and recorded"),
    onError: onErr,
  });

  return (
    <Card className={cn(t.age_minutes >= 20 && "border-amber-500")}>
      <CardHeader className="pb-2">
        <CardTitle
          className={cn("flex items-center justify-between", compact ? "text-sm" : "text-base")}
        >
          <span>
            KOT #{t.kot_number} · {t.order_number_snapshot}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{t.age_minutes}m ago</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t.table_number_snapshot ? `Table ${t.table_number_snapshot} · ` : ""}
          <span className="capitalize">{t.channel.replace("_", " ")}</span> ·{" "}
          <span className="capitalize">{t.status.toLowerCase()}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {t.lines.map((l) => (
          <div
            key={l.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 text-sm",
              compact ? "py-1" : "py-1.5",
              l.status === "VOIDED" && "bg-destructive/10 text-destructive line-through",
              l.status === "ACCEPTED" && "bg-sky-500/10",
              l.status === "PREPARING" && "bg-amber-500/10",
              l.status === "READY" && "bg-green-500/10",
            )}
          >
            <span>
              {l.qty - l.voided_qty}× {l.item_name_snapshot}
              {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
              {l.modifiers_snapshot.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  + {l.modifiers_snapshot.join(", ")}
                </span>
              )}
              {l.instructions && <span className="block text-xs italic">“{l.instructions}”</span>}
            </span>
            {l.status === "PREPARING" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={lineMut.isPending}
                onClick={() => lineMut.mutate(l.id)}
              >
                <Icons.check className="mr-1 h-4 w-4" /> Ready
              </Button>
            )}
            {l.status === "ACCEPTED" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={startLineMut.isPending}
                onClick={() => startLineMut.mutate(l.id)}
                title="Start preparing this item"
              >
                <Icons.kitchen className="mr-1 h-4 w-4" /> Start
              </Button>
            )}
            {l.status === "PENDING" && t.status !== "SERVED" && t.status !== "CANCELLED" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={acceptLineMut.isPending}
                onClick={() => acceptLineMut.mutate(l.id)}
                title="Accept this item"
              >
                <Icons.check className="mr-1 h-4 w-4" /> Accept
              </Button>
            )}
            {(l.status === "PENDING" ||
              l.status === "ACCEPTED" ||
              l.status === "PREPARING" ||
              l.status === "READY") &&
              t.status !== "SERVED" &&
              t.status !== "CANCELLED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={voidLineMut.isPending}
                  onClick={() => {
                    setLineVoidReason("");
                    setLineVoidQty(l.qty - l.voided_qty);
                    setLineVoid({
                      lineId: l.id,
                      name: l.item_name_snapshot,
                      max: l.qty - l.voided_qty,
                    });
                  }}
                  title="Void this item with a reason"
                >
                  <Icons.trash className="size-4" />
                </Button>
              )}
          </div>
        ))}
        {t.voids.length > 0 && (
          <div className="border-t pt-1">
            {t.voids.map((v) => (
              <p key={v.id} className="text-xs text-destructive">
                Voided {v.qty}× — {v.reason}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {t.status === "NEW" && (
            <Button size="sm" disabled={acceptMut.isPending} onClick={() => acceptMut.mutate()}>
              Accept
            </Button>
          )}
          {t.status === "ACCEPTED" && (
            <Button size="sm" disabled={prepMut.isPending} onClick={() => prepMut.mutate()}>
              Start preparing
            </Button>
          )}
          {t.status === "READY" && (
            <Button size="sm" disabled={serveMut.isPending} onClick={() => serveMut.mutate()}>
              Mark served
            </Button>
          )}
          {t.status !== "CANCELLED" && t.status !== "SERVED" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                setReason("");
                setVoidOpen(true);
              }}
            >
              <Icons.trash className="mr-1 h-4 w-4" /> Void
            </Button>
          )}
        </div>

        <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void KOT #{t.kot_number}?</DialogTitle>
              <DialogDescription>
                Recorded on the ticket with your reason; kitchen-consumed items flow to waste.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Out of stock, duplicate…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoidOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={voidMut.isPending || !reason.trim()}
                onClick={() => {
                  voidMut.mutate(reason.trim());
                  setVoidOpen(false);
                }}
              >
                Void KOT
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={lineVoid != null} onOpenChange={(o) => !o && setLineVoid(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void {lineVoid?.name}?</DialogTitle>
              <DialogDescription>
                Recorded on the ticket with your reason; only started items flow to waste.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Qty (max {lineVoid?.max})</Label>
                <Input
                  type="number"
                  min={1}
                  max={lineVoid?.max ?? 1}
                  value={lineVoidQty}
                  onChange={(e) => setLineVoidQty(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason *</Label>
                <Input
                  placeholder="Out of stock, burnt…"
                  value={lineVoidReason}
                  onChange={(e) => setLineVoidReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLineVoid(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  voidLineMut.isPending ||
                  !lineVoidReason.trim() ||
                  !lineVoid ||
                  lineVoidQty < 1 ||
                  lineVoidQty > lineVoid.max
                }
                onClick={() =>
                  lineVoid &&
                  voidLineMut.mutate({
                    lineId: lineVoid.lineId,
                    qty: lineVoidQty,
                    r: lineVoidReason.trim(),
                  })
                }
              >
                Void item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

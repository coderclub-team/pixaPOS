"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
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
  markLineReady,
  serveKOT,
  startPreparingKOT,
  voidKOT,
} from "@/features/kitchen/api/service";
import type { KitchenTicketWithDerived, KOTStatus } from "@/features/kitchen/api/types";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

type BoardFilter = KOTStatus | "ALL";
const COLUMNS: { status: BoardFilter; label: string }[] = [
  { status: "ALL", label: "All live" },
  { status: "NEW", label: "New" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready" },
];

export default function KitchenBoardPage() {
  const [filter, setFilter] = useState<BoardFilter>("ALL");
  const { data: tickets, isPending } = useQuery(
    kitchenTicketsQueryOptions(filter === "ALL" ? {} : { status: filter as KOTStatus }),
  );

  const live = (tickets ?? []).filter((t) => t.status !== "SERVED" && t.status !== "CANCELLED");

  if (isPending) {
    return (
      <PageContainer pageTitle="Kitchen" pageDescription="Sales — Kitchen display" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Kitchen"
      pageDescription="Live kitchen tickets — accept, prepare, mark ready, serve."
      pageHeaderAction={
        <Button variant="outline" size="sm" onClick={() => getQueryClient().invalidateQueries({ queryKey: kitchenKeys.all })}>
          Refresh board
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {COLUMNS.map((c) => (
          <Button
            key={c.label}
            variant={filter === c.status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(c.status)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {live.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {live.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function invalidateBoard() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: kitchenKeys.all });
  qc.invalidateQueries({ queryKey: ["orders"] });
}

function TicketCard({ ticket: t }: { ticket: KitchenTicketWithDerived }) {
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");

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
  const voidMut = useMutation({
    mutationFn: (r: string) => voidKOT(t.id, { reason: r }),
    onSuccess: onOk("KOT voided and recorded"),
    onError: onErr,
  });

  return (
    <Card className={cn(t.age_minutes >= 20 && "border-amber-500")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
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
              "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
              l.status === "VOIDED" && "bg-destructive/10 text-destructive line-through",
              l.status === "READY" && "bg-green-500/10",
            )}
          >
            <span>
              {l.qty - l.voided_qty}× {l.item_name_snapshot}
              {l.variant_name_snapshot ? ` (${l.variant_name_snapshot})` : ""}
              {l.modifiers_snapshot.length > 0 && (
                <span className="text-xs text-muted-foreground"> + {l.modifiers_snapshot.join(", ")}</span>
              )}
              {l.instructions && <span className="block text-xs italic">“{l.instructions}”</span>}
            </span>
            {(l.status === "PENDING" || l.status === "PREPARING") && (
              <Button
                variant="ghost"
                size="sm"
                disabled={lineMut.isPending}
                onClick={() => lineMut.mutate(l.id)}
              >
                <Icons.check className="mr-1 h-4 w-4" /> Ready
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
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Out of stock, duplicate…" />
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
      </CardContent>
    </Card>
  );
}

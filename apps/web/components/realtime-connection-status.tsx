"use client";

import { cn } from "@pixa/ui/lib/utils";
import type { RealtimeState } from "@/lib/realtime/use-realtime";

const LABEL: Record<RealtimeState, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  live: "Connected",
  reconnecting: "Reconnecting…",
  offline: "Offline",
  error: "Error",
};

const DOT: Record<RealtimeState, string> = {
  idle: "bg-zinc-400",
  connecting: "bg-amber-500 animate-pulse",
  live: "bg-emerald-500",
  reconnecting: "bg-amber-500 animate-pulse",
  offline: "bg-zinc-400",
  error: "bg-red-500",
};

export function RealtimeConnectionStatus({
  state,
  lastSequence,
  className,
}: {
  state: RealtimeState;
  lastSequence?: number;
  className?: string;
}) {
  return (
    <span
      title={lastSequence ? `Seq ${lastSequence} · ${LABEL[state]}` : LABEL[state]}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      <span className={cn("size-1.5 rounded-full", DOT[state])} aria-hidden />
      <span className="hidden sm:inline">{LABEL[state]}</span>
      <span className="sm:hidden" aria-hidden>
        ●
      </span>
    </span>
  );
}

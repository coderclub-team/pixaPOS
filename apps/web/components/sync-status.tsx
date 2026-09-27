"use client";

import { useEffect, useState } from "react";
import { cn } from "@pixa/ui/lib/utils";
import { outboxStatusCounts } from "@/lib/db/outbox";
import { runSyncCycle } from "@/lib/db/sync-engine";

/**
 * Sync status pill for pos/kds headers (offline doc rule: sync state is
 * always visible, never silent). Green = drained, amber = pending,
 * red = failed rows need attention, gray = browser offline. Click retries.
 */
export default function SyncStatus({ className }: { className?: string }) {
  const [counts, setCounts] = useState({ pending: 0, failed: 0, synced: 0 });
  const [online, setOnline] = useState(true);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const c = await outboxStatusCounts();
        if (!cancelled) setCounts(c);
      } catch {}
    };
    const onStatus = () => setOnline(window.navigator.onLine);
    setOnline(window.navigator.onLine);
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    void load();
    const t = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
    };
  }, []);

  const retry = async () => {
    setSpinning(true);
    try {
      await runSyncCycle();
      setCounts(await outboxStatusCounts());
    } catch {
    } finally {
      setSpinning(false);
    }
  };

  const dot = !online
    ? "bg-zinc-400"
    : counts.failed > 0
      ? "bg-red-500"
      : counts.pending > 0
        ? "bg-amber-500 animate-pulse"
        : "bg-emerald-500";
  const label = !online
    ? "Offline"
    : counts.failed > 0
      ? `${counts.failed} failed`
      : counts.pending > 0
        ? `${counts.pending} pending`
        : "Synced";

  return (
    <button
      type="button"
      onClick={retry}
      title={`Sync: ${label} — click to retry now`}
      aria-label={`Sync status: ${label}. Activate to retry.`}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot, spinning && "animate-spin")} />
      {label}
    </button>
  );
}

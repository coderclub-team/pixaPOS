"use client";

import { cn } from "@pixa/ui/lib/utils";
/* OFFLINE-FIRST-DISABLED: outbox polling + manual retry commented out below.
 * The pill is a static online indicator until sync returns.
import { useEffect, useState } from "react";
import { outboxStatusCounts } from "@/lib/db/outbox";
import { runSyncCycle } from "@/lib/db/sync-engine";
*/

/**
 * Online indicator for pos/kds headers. (Previously a live sync-status
 * pill — green = sent, amber = pending, red = failed, gray = offline, click
 * to retry. See OFFLINE-FIRST-DISABLED block below to restore.)
 */
export default function SyncStatus({ className }: { className?: string }) {
  return (
    <span
      title="Online"
      aria-label="Sync status: online (sync disabled)"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-muted-foreground",
        "max-sm:gap-0 max-sm:px-1.5",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", "bg-emerald-500")} />
      <span className="max-sm:hidden">Online</span>
    </span>
  );
}

/* OFFLINE-FIRST-DISABLED: live outbox pill. Restore to re-enable.
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
        : "Sent";
  const hint =
    !online || counts.failed > 0 || counts.pending > 0
      ? `Sync: ${label} — click to retry now`
      : "Sent to server — server-side apply lands next";

  return (
    <button
      type="button"
      onClick={retry}
      title={hint}
      aria-label={`Sync status: ${label}. Activate to retry.`}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        "max-sm:gap-0 max-sm:px-1.5",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot, spinning && "animate-spin")} />
      <span className="max-sm:hidden">{label}</span>
    </button>
  );
}
*/

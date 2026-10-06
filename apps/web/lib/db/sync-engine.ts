/**
 * Sync processor: drains pending outbox envelopes to the hub (LAN) or cloud
 * origin, with retry bookkeeping. Triggered on `online`, on an interval, on
 * tab focus, and manually. Never throws — failures land on the rows as
 * retry_count/last_error and surface in the sync status UI.
 *
 * Server application of entity snapshots + pull hydration land next; this
 * loop already moves envelopes through pending → synced with idempotent
 * server acks, so transport, retry and visibility are verifiable now.
 */
import { markOutboxFailed, markOutboxSynced, pendingOutboxBatch } from "./outbox";
import { apiUrl, checkHub, getHubUrl } from "../hub";

export type SyncCycleResult =
  | { ran: false; reason: "offline" | "empty" | "locked" }
  | { ran: true; sent: number; acked: number; origin: string };

let running = false;
let timer: number | null = null;
let onOnline: (() => void) | null = null;
let onFocus: (() => void) | null = null;

async function resolveOrigin(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!window.navigator.onLine) return null;
  const hub = getHubUrl();
  if (hub) {
    const health = await checkHub(hub);
    if (health) return hub;
    // Hub configured but unreachable — fall through to cloud origin rather
    // than stalling the queue behind a dead hub.
  }
  return window.location.origin;
}

export async function runSyncCycle(): Promise<SyncCycleResult> {
  if (running) return { ran: false, reason: "locked" };
  running = true;
  try {
    const origin = await resolveOrigin();
    if (!origin) return { ran: false, reason: "offline" };
    const batch = await pendingOutboxBatch(100).catch(() => []);
    if (batch.length === 0) return { ran: false, reason: "empty" };
    const ids = batch.map((c) => c.command_id);
    let res: Response;
    try {
      res = await fetch(`${origin}/api/sync/push`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commands: batch.map((c) => ({ ...c, device_seq: Number(c.device_seq) || 0 })),
        }),
      });
    } catch (e) {
      await markOutboxFailed(ids, e instanceof Error ? e.message : "network failed");
      return { ran: true, sent: batch.length, acked: 0, origin };
    }
    if (!res.ok) {
      // 503 = sync disabled server-side: back off quietly without penalizing
      // rows (no retry_count bump); anything else is a real failure.
      if (res.status !== 503) {
        await markOutboxFailed(ids, `push ${res.status}`);
      }
      return { ran: true, sent: batch.length, acked: 0, origin };
    }
    const body = (await res.json().catch(() => null)) as {
      results?: { command_id: string; ok?: boolean; error?: string }[];
    } | null;
    const acked = (body?.results ?? []).filter((r) => r.ok !== false).map((r) => r.command_id);
    const failed = (body?.results ?? []).filter((r) => r.ok === false);
    if (acked.length > 0) await markOutboxSynced(acked);
    for (const f of failed) {
      await markOutboxFailed([f.command_id], f.error ?? "rejected");
    }
    // Transport-level success with no per-command verdicts: trust the ack.
    if (acked.length === 0 && failed.length === 0) {
      await markOutboxSynced(ids);
      return { ran: true, sent: batch.length, acked: batch.length, origin };
    }
    return { ran: true, sent: batch.length, acked: acked.length, origin };
  } finally {
    running = false;
  }
}

export function startSyncEngine(intervalMs = 30000): () => void {
  if (typeof window === "undefined") return () => {};
  if (timer) return () => stopSyncEngine();
  const kick = () => {
    void runSyncCycle();
  };
  onOnline = () => {
    void runSyncCycle();
  };
  onFocus = () => {
    if (document.visibilityState === "visible") void runSyncCycle();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onFocus);
  timer = window.setInterval(kick, intervalMs);
  void runSyncCycle();
  return () => stopSyncEngine();
}

export function stopSyncEngine(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (typeof window !== "undefined") {
    if (onOnline) window.removeEventListener("online", onOnline);
    if (onFocus) document.removeEventListener("visibilitychange", onFocus);
    onOnline = null;
    onFocus = null;
  }
}

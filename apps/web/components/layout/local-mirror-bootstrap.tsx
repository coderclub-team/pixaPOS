"use client";

import { useEffect } from "react";
import { ensureLocalMirror } from "@/lib/db/bootstrap";
/* OFFLINE-FIRST-DISABLED: sync engine + SW registration commented out (see below).
import { startSyncEngine } from "@/lib/db/sync-engine";
*/
import { maybeAutoSnapshot } from "@/features/system/api/service";
/* OFFLINE-FIRST-DISABLED: see above.
import { useServiceWorker } from "@/hooks/use-service-worker";
*/

/**
 * Mount once at the app root: purge legacy mock data once, adopt the durable
 * SQLite mirror on startup, then start the outbox sync processor (online
 * events, interval, focus). Also registers the shared service worker here so
 * dashboard, kot and any future route get offline shell caching even if never
 * visited via pos/kds.
 */
export default function LocalMirrorBootstrap() {
  /* OFFLINE-FIRST-DISABLED: service-worker registration commented out —
   * re-enable with useServiceWorker() to restore offline shells. */
  // useServiceWorker();
  useEffect(() => {
    void purgeLegacyMockData().finally(() => {
      void ensureLocalMirror().finally(() => {});
    });
    maybeAutoSnapshot();
    /* OFFLINE-FIRST-DISABLED: sync engine commented out — nothing drains
     * the outbox until this is restored.
    const stop = startSyncEngine();
    return () => stop();
    */
    return () => {};
  }, []);
  return null;
}

/**
 * One-time purge of the static mock era (seed out_001 outlet, demo tables,
 * menu, inventory, orders). Runs once per browser (version flag) — user data
 * created after this version is untouched.
 */
const PURGE_FLAG = "pixa:mock-purged-v1";
const MOCK_KEYS = [
  "pixaOutlet",
  "pixaOrders",
  "pixaKOTs",
  "pixaTables",
  "pixaFloors",
  "pixaMenu",
  "pixaEvents",
  "pixaPayments",
  "pixaReturns",
  "pixaCustomers",
  "pixaInventory",
  "pixaPOs",
];

async function purgeLegacyMockData(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(PURGE_FLAG)) return;
    for (const key of MOCK_KEYS) window.localStorage.removeItem(key);
    // Drop the legacy active-outlet pointer so resolution re-derives from server.
    if (window.localStorage.getItem("pixa:activeOutlet") === "out_001") {
      window.localStorage.removeItem("pixa:activeOutlet");
    }
    // Clear the SQLite durable mirror too, or hydrate-from-mirror would
    // restore the same mock rows right back into localStorage.
    try {
      const { initLocalDb, localExec } = await import("@/lib/db/sqlite");
      if ((await initLocalDb()) === "sqlite") {
        await localExec("DELETE FROM documents", []);
        await localExec("DELETE FROM sync_outbox", []);
        await localExec("DELETE FROM events", []);
      }
    } catch {}
    window.localStorage.setItem(PURGE_FLAG, "1");
  } catch {}
}

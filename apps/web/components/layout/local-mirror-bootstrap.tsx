"use client";

import { useEffect } from "react";
import { ensureLocalMirror } from "@/lib/db/bootstrap";
import { startSyncEngine } from "@/lib/db/sync-engine";
import { maybeAutoSnapshot } from "@/features/system/api/service";
import { useServiceWorker } from "@/hooks/use-service-worker";

/**
 * Mount once at the app root: adopt the durable SQLite mirror on startup,
 * then start the outbox sync processor (online events, interval, focus).
 * Also registers the shared service worker here so dashboard, kot and any
 * future route get offline shell caching even if never visited via pos/kds.
 */
export default function LocalMirrorBootstrap() {
  useServiceWorker();
  useEffect(() => {
    void ensureLocalMirror().finally(() => {});
    maybeAutoSnapshot();
    const stop = startSyncEngine();
    return () => stop();
  }, []);
  return null;
}

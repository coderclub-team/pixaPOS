"use client";

import { useEffect } from "react";
import { ensureLocalMirror } from "@/lib/db/bootstrap";
import { startSyncEngine } from "@/lib/db/sync-engine";

/**
 * Mount once at the app root: adopt the durable SQLite mirror on startup,
 * then start the outbox sync processor (online events, interval, focus).
 */
export default function LocalMirrorBootstrap() {
  useEffect(() => {
    void ensureLocalMirror().finally(() => {});
    const stop = startSyncEngine();
    return () => stop();
  }, []);
  return null;
}

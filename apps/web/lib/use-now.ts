"use client";

import { useEffect, useState } from "react";

/**
 * Ticking clock for relative ages ("5m old") in views that don't otherwise
 * re-render on a poll (bill KOT accordion, terminal). Views with their own
 * refetch interval (orders list, KDS) don't need it.
 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

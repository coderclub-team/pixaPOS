"use client";

import { useEffect, useState } from "react";

/**
 * Registers the PWA offline shell (/sw.js) and reports readiness.
 * Skipped on localhost: dev recompiles turn every transient failure into a
 * permanently cached stall — offline is tested on preview builds instead.
 */
export function useServiceWorker(): boolean {
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => !cancelled && setSwReady(true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return swReady;
}

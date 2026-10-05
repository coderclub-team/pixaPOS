"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Registers the PWA offline shell (/sw.js) and reports readiness.
 * Skipped on localhost: dev recompiles turn every transient failure into a
 * permanently cached stall — offline is tested on preview builds instead.
 *
 * Update flow (the reason deploys seemed "not live"): when a new SW is
 * installed while an old one controls the page, we toast "New version
 * available" with a Refresh action that SKIP_WAITINGs + reloads into the
 * fresh shell. Without this, browsers serve the stale cached app forever.
 */
export function useServiceWorker(): boolean {
  const [swReady, setSwReady] = useState(false);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        const waiting = reg?.waiting;
        if (waiting) {
          waiting.postMessage("SKIP_WAITING");
        } else {
          window.location.reload();
        }
      })
      .catch(() => window.location.reload());
  }, []);

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
    let cleanupExtra: (() => void) | null = null;
    let toastShown = false;
    const promptUpdate = () => {
      if (toastShown || cancelled) return;
      toastShown = true;
      toast.info("New version available", {
        description: "Refresh to load the latest features.",
        action: { label: "Refresh", onClick: applyUpdate },
        duration: Infinity,
      });
    };
    const track = (reg: ServiceWorkerRegistration) => {
      const found = () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          // Installed + page already controlled = update waiting.
          if (next.state === "installed" && reg.active && !cancelled) promptUpdate();
        });
      };
      reg.addEventListener("updatefound", found);
      // A waiting worker from a previous visit (tab closed mid-update).
      if (reg.waiting && reg.active) promptUpdate();
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        setSwReady(true);
        track(reg);
        // Check for updates on visibility + hourly (browsers also check
        // automatically roughly every 24h — too slow for daily shipping).
        const check = () => reg.update().catch(() => {});
        const onVis = () => {
          if (document.visibilityState === "visible") check();
        };
        document.addEventListener("visibilitychange", onVis);
        const timer = window.setInterval(check, 60 * 60 * 1000);
        const onController = () => window.location.reload();
        navigator.serviceWorker.addEventListener("controllerchange", onController);
        cleanupExtra = () => {
          document.removeEventListener("visibilitychange", onVis);
          window.clearInterval(timer);
          navigator.serviceWorker.removeEventListener("controllerchange", onController);
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      cleanupExtra?.();
    };
  }, [applyUpdate]);

  return swReady;
}

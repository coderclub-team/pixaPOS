"use client";

import { useEffect, useState } from "react";
// NOTE: `toast` import removed with the OFFLINE-FIRST-DISABLED update prompt above.

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
  /* OFFLINE-FIRST-DISABLED: no service-worker registration. We actively
   * unregister any previously installed worker so stale offline shells
   * can't serve the app. To re-enable, restore the register() flow
   * (original in git history) and the useServiceWorker() call in
   * local-mirror-bootstrap.
   */
  const [swReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  }, []);

  return swReady;
}

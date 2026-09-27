"use client";

import { useCallback, useEffect, useState } from "react";

export type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * Captured at module scope so an event that fires before any component
 * mounts (e.g. during chunk load) is never missed. The deferred prompt can
 * only be used once — after prompt() the browser clears it.
 */
let captured: InstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    captured = e as InstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pixa:install-available"));
  });
  window.addEventListener("appinstalled", () => {
    captured = null;
    window.dispatchEvent(new CustomEvent("pixa:install-taken"));
  });
}

/**
 * Shared PWA install prompt state (beforeinstallprompt). One listener per
 * mount; call promptInstall() from a header Install button. Shows only when
 * the browser actually offers installation — silent otherwise.
 */
export function useInstallPrompt() {
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(() => captured);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (captured) setInstallEvt(captured);
    const onAvailable = () => setInstallEvt(captured);
    const onTaken = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("pixa:install-available", onAvailable);
    window.addEventListener("pixa:install-taken", onTaken);
    window.addEventListener("appinstalled", onTaken);
    return () => {
      window.removeEventListener("pixa:install-available", onAvailable);
      window.removeEventListener("pixa:install-taken", onTaken);
      window.removeEventListener("appinstalled", onTaken);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const evt = installEvt ?? captured;
    if (!evt || typeof evt.prompt !== "function") return;
    await evt.prompt();
    captured = null;
    setInstallEvt(null);
  }, [installEvt]);

  return { installEvt, installed, promptInstall };
}

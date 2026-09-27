"use client";

import { useCallback, useEffect, useState } from "react";

export type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * Shared PWA install prompt state (beforeinstallprompt). One listener per
 * mount; call promptInstall() from a header Install button.
 */
export function useInstallPrompt() {
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  }, [installEvt]);

  return { installEvt, installed, promptInstall };
}

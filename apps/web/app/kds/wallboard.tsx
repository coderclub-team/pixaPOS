"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import KdsBoard from "@/features/kitchen/components/kds-board";

type BIPEvent = Event & { prompt: () => Promise<void> };

/**
 * Standalone KDS wallboard: full-viewport board, install prompt, wake lock,
 * service-worker registration. No dashboard shell — mount on a wall tablet,
 * sign in once, Add to Home Screen.
 */
export default function KdsWallboard() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [wake, setWake] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Never register the caching worker on localhost: dev recompiles turn
    // every transient failure into a permanently cached stall.
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => !cancelled && setSwReady(true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        };
        if (!nav.wakeLock) return;
        lock = await nav.wakeLock.request("screen");
        if (!cancelled) setWake(true);
      } catch {
        /* unsupported or denied — board works regardless */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  }, [installEvt]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <Link href="/dashboard/overview" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="pixaPOS" className="size-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">pixaPOS · Kitchen</span>
            <span className="block text-[11px] text-muted-foreground">
              {swReady ? "Offline-ready" : "Connecting…"}
              {wake ? " · Screen awake" : ""}
            </span>
          </span>
        </Link>
        <span className="flex items-center gap-1.5">
          {!installed && installEvt && (
            <Button size="sm" onClick={install}>
              <Icons.add className="mr-1 size-4" /> Install
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/kitchen" />}
          >
            Dashboard
          </Button>
        </span>
      </header>
      <main className="flex-1 overflow-y-auto p-3">
        <KdsBoard compact />
      </main>
    </div>
  );
}

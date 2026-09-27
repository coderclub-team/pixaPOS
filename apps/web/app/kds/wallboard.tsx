"use client";

import { useEffect, useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import SyncStatus from "@/components/sync-status";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pixa/ui/base-ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useServiceWorker } from "@/hooks/use-service-worker";
import KdsBoard from "@/features/kitchen/components/kds-board";

/**
 * Standalone KDS wallboard: shared AppSidebar (role-filtered nav, same as
 * /kot and /dashboard) + full-viewport board, install prompt, wake lock,
 * service-worker registration. Mount on a wall tablet, sign in once, Add to
 * Home Screen.
 */
export default function KdsWallboard() {
  const { installEvt, installed, promptInstall: install } = useInstallPrompt();
  const swReady = useServiceWorker();
  const [wake, setWake] = useState(false);

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

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-dvh flex-col overflow-hidden bg-background">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <span className="leading-tight">
                <span className="block text-sm font-bold">Kitchen</span>
                <span className="block text-[11px] text-muted-foreground">
                  {swReady ? "Offline-ready" : "Connecting…"}
                  {wake ? " · Screen awake" : ""}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <SyncStatus />
              <ThemeModeToggle />
              {!installed && installEvt && (
                <Button size="sm" onClick={install}>
                  <Icons.download className="mr-1 size-4" /> Install
                </Button>
              )}
            </span>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-3">
            <KdsBoard compact />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

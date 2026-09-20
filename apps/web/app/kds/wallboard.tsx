"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@pixa/ui/base-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Icons } from "@pixa/ui/icons";
import { UserAvatarProfile } from "@pixa/ui/user-avatar-profile";
import { useIdentity } from "@/hooks/use-identity";
import KdsBoard from "@/features/kitchen/components/kds-board";

type BIPEvent = Event & { prompt: () => Promise<void> };

/**
 * Standalone KDS wallboard: full-viewport board, install prompt, wake lock,
 * service-worker registration. No dashboard shell — mount on a wall tablet,
 * sign in once, Add to Home Screen.
 */
export default function KdsWallboard() {
  const router = useRouter();
  const { user, signOut } = useIdentity();
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
    // every transient failure into a permanently cached stall. Actively drop
    // any worker a previous session registered, so a poisoned cache cannot
    // survive into this load.
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
          {user && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 px-1.5"
                    aria-label="Account menu"
                  />
                }
              >
                <UserAvatarProfile className="size-7 rounded-full" user={user} />
                <Icons.chevronsDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
                    <Icons.notification className="mr-2 size-4" />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <Icons.logout aria-hidden className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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

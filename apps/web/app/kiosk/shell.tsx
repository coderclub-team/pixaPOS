"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

/**
 * Kiosk shell: registers the shared PWA service worker so this device —
 * which may never visit /pos or /kds — still gets offline shell caching.
 * One registration covers every route on the origin.
 */
export default function KioskShell({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  return <>{children}</>;
}

"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

/**
 * QR table-ordering shell: registers the shared PWA service worker so
 * customer phones get offline shell caching even though they only ever
 * load /qr. One registration covers every route on the origin.
 */
export default function QrShell({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  return <>{children}</>;
}

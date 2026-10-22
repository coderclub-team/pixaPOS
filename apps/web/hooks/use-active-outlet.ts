"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOutletStorageKey,
  outletsQueryOptions,
  resolveActiveOutlet,
  setActiveOutletId,
  getActiveOutletId,
} from "@/features/outlet/api/queries";

/**
 * Reactive active-outlet id for terminal surfaces. Null when no outlet is
 * active — callers show setup instead of mock data. Re-resolves when the
 * server list changes; persists the first resolution so service
 * write-fallbacks (sync localStorage reads) converge on the same outlet.
 * Cross-tab switches propagate via storage events + query invalidation.
 */
export function useActiveOutletId(): string | null {
  const pathname = usePathname();
  const { data: outlets } = useQuery(outletsQueryOptions);
  const [, setTick] = useState(0);
  const storageKey = getActiveOutletStorageKey(pathname);
  const resolved = resolveActiveOutlet(outlets ?? [], pathname);

  useEffect(() => {
    if (!outlets || outlets.length === 0) return;
    const current = getActiveOutletId(pathname);
    if (!current && resolved) setActiveOutletId(resolved, pathname);
    else if (current && !outlets.some((outlet) => outlet.id === current)) {
      setActiveOutletId(resolved ?? outlets[0]?.id ?? "", pathname);
    }
  }, [outlets, pathname, resolved]);

  // Cross-tab or same-tab "Use here" updates should re-resolve immediately.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setTick((t) => t + 1);
    };
    const onOutletChange = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      if (detail?.key === storageKey) setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pixa:active-outlet-change", onOutletChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pixa:active-outlet-change", onOutletChange);
    };
  }, [storageKey]);

  return getActiveOutletId(pathname) ?? resolved;
}

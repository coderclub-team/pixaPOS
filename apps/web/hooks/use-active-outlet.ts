"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
  const { data: outlets } = useQuery(outletsQueryOptions);
  const [, setTick] = useState(0);
  const resolved = resolveActiveOutlet(outlets ?? []);

  useEffect(() => {
    if (!outlets || outlets.length === 0) return;
    if (!getActiveOutletId()) setActiveOutletId(resolved);
  }, [outlets, resolved]);

  // Cross-tab "Use here" from another tab re-resolves here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pixa:activeOutlet") setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return resolved;
}

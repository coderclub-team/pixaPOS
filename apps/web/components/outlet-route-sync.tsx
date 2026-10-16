"use client";

import { useEffect } from "react";
import { setActiveOutletId, getActiveOutletId } from "@/features/outlet/api/queries";
import { getQueryClient } from "@/lib/query-client";

/**
 * Syncs the URL outlet into the terminal's active-outlet storage so every
 * downstream hook (useActiveOutletId, realtime bootstrap, queries) follows
 * the route. Runs before children effects on mount and on outlet change.
 */
export function OutletRouteSync({
  outletId,
  children,
}: {
  outletId: string;
  children: React.ReactNode;
}) {
  if (typeof window !== "undefined" && getActiveOutletId() !== outletId) {
    setActiveOutletId(outletId);
  }

  useEffect(() => {
    setActiveOutletId(outletId);
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["kitchen"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["floors"] });
  }, [outletId]);

  return <>{children}</>;
}

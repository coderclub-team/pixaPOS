"use client";

import { useEffect } from "react";
import { setActiveOutletId, getActiveOutletId } from "@/features/outlet/api/queries";
import { getQueryClient } from "@/lib/query-client";

/**
 * Syncs the URL outlet into the terminal's active-outlet storage so every
 * downstream hook (useActiveOutletId, realtime bootstrap, queries) follows
 * the route. Effect-only (no render-phase writes): the header switcher moves
 * the URL along on outlet-scoped routes, so the two converge instead of the
 * route reverting an explicit switch.
 */
export function OutletRouteSync({
  outletId,
  children,
}: {
  outletId: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (getActiveOutletId(window.location.pathname) !== outletId)
      setActiveOutletId(outletId, window.location.pathname);
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["kitchen"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["floors"] });
  }, [outletId]);

  return <>{children}</>;
}

import { queryOptions } from "@tanstack/react-query";

export const outletListKeys = {
  all: ["outlet"] as const,
  list: () => [...outletListKeys.all, "list"] as const,
};

export type OutletRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
};

export const outletsQueryOptions = queryOptions({
  queryKey: outletListKeys.list(),
  queryFn: async (): Promise<OutletRow[]> => {
    const res = await fetch("/api/outlets", { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { outlets?: OutletRow[] };
    return data.outlets ?? [];
  },
  staleTime: 30_000,
});

/** Active outlet for this terminal (per-browser, survives reload). */
const ACTIVE_OUTLET_KEY = "pixa:activeOutlet";

export function getActiveOutletId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_OUTLET_KEY);
  } catch {
    return null;
  }
}

export function setActiveOutletId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_OUTLET_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the terminal's outlet. Server data only — no mock fallback:
 * 1. stored id (explicit "Use here"),
 * 2. first server outlet,
 * 3. null (no outlet — surfaces must show setup, not mock data).
 */
export function resolveActiveOutlet(outlets: OutletRow[]): string | null {
  const stored = getActiveOutletId();
  if (stored) return stored;
  return outlets[0]?.id ?? null;
}

/**
 * Sync outlet id for service write-fallbacks (services can't await the server
 * list). Null when nothing is stored — callers must handle "no outlet"
 * instead of writing to a mock outlet.
 */
export function getServiceOutletId(): string | null {
  return getActiveOutletId();
}

/**
 * Fail-closed outlet for create paths (floors, tables, and other
 * outlet-owned entities). Throws a user-actionable error instead of
 * persisting a null outlet that would orphan the row.
 */
export function requireServiceOutletId(): string {
  const id = getServiceOutletId();
  if (!id) throw new Error("No outlet selected — select or create one first");
  return id;
}

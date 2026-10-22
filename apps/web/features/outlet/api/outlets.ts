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

/** Active outlet for this route / terminal scope. A global browser id was
 * causing one outlet to leak across unrelated surfaces; we now scope the
 * selection to the current route and keep the browser as the user-level bucket.
 */
const ACTIVE_OUTLET_KEY_PREFIX = "pixa:activeOutlet";
const ACTIVE_OUTLET_CHANGE_EVENT = "pixa:active-outlet-change";

export function getActiveOutletStorageKey(
  pathname = typeof window !== "undefined" ? window.location.pathname : "/",
): string {
  const normalized = pathname?.replace(/^\/+|\/+$/g, "") ?? "";
  const scope = normalized ? (normalized.split("/").filter(Boolean)[0] ?? "root") : "root";
  return `${ACTIVE_OUTLET_KEY_PREFIX}:${scope}`;
}

export function emitActiveOutletChange(key: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVE_OUTLET_CHANGE_EVENT, { detail: { key } }));
}

export function getActiveOutletId(pathname?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(getActiveOutletStorageKey(pathname));
  } catch {
    return null;
  }
}

export function setActiveOutletId(id: string, pathname?: string): void {
  if (typeof window === "undefined") return;
  const key = getActiveOutletStorageKey(pathname);
  try {
    window.localStorage.setItem(key, id);
    emitActiveOutletChange(key);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the terminal's outlet. Server data only — no mock fallback:
 * 1. valid stored id for this route scope (explicit "Use here"),
 * 2. first outlet in the active dashboard/settings list order,
 * 3. null (no outlet — surfaces must show setup, not mock data).
 *
 * The app uses the route-scoped list order as the resilience default, not a
 * created_at-derived fallback, so first selection follows the same ordering the
 * user sees in settings/outlets rather than hidden timestamp semantics.
 */
export function resolveActiveOutlet(outlets: OutletRow[], pathname?: string): string | null {
  const stored = getActiveOutletId(pathname);
  if (stored) {
    const matches = outlets.some((o) => o.id === stored);
    if (matches) return stored;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(getActiveOutletStorageKey(pathname));
      } catch {
        /* ignore */
      }
    }
  }

  const activeList = Array.isArray(outlets) ? outlets : [];
  if (activeList.length === 0) return null;

  const defaultOutlet = activeList[0];
  if (!defaultOutlet?.id) return null;

  return defaultOutlet.id;
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

/**
 * Rewrite an outlet-scoped pathname (/pos/<from>, /kds/<from>, …) to a new
 * outlet id. Returns null when the path carries no outlet segment, so the
 * header switcher knows a storage-only switch suffices. Pure — unit tested.
 */
export function swapOutletSegment(pathname: string, fromId: string, toId: string): string | null {
  if (!fromId || !toId || fromId === toId) return null;
  const segs = pathname.split("/");
  const idx = segs.indexOf(fromId);
  if (idx === -1) return null;
  segs[idx] = toId;
  return segs.join("/");
}

/**
 * Role → surfaces map. Single source for which operations surfaces
 * (/dashboard, /pos, /kds, /kot, /dispatch, /rider) a role may open.
 * Kiosk/QR stay public (customers). Enforced in the surface switcher,
 * proxy gates, and realtime auth — never client-side only.
 */

export type SurfaceKey = "dashboard" | "pos" | "kds" | "kot" | "dispatch" | "rider";

export const SURFACE_ROUTES: Record<SurfaceKey, string> = {
  dashboard: "/dashboard",
  pos: "/pos",
  kds: "/kds",
  kot: "/kot",
  dispatch: "/dispatch",
  rider: "/rider",
};

const ALL: SurfaceKey[] = ["dashboard", "pos", "kds", "kot", "dispatch", "rider"];

function norm(role: string | null | undefined): string {
  const r = (role ?? "").toLowerCase();
  return r.startsWith("org:") ? r.slice(4) : r;
}

/** Surfaces a role may access. Unknown roles get nothing (fail-closed). */
export function allowedSurfaces(role: string | null | undefined): SurfaceKey[] {
  switch (norm(role)) {
    case "admin":
    case "owner":
    case "manager":
      return [...ALL];
    case "cashier":
      return ["dashboard", "pos", "dispatch"];
    case "waiter":
      return ["pos", "kot"];
    case "kitchen":
      return ["kds", "kot"];
    case "accountant":
      return ["dashboard"];
    default:
      return [];
  }
}

/** Route path → surface key, or null for public/non-surface paths. */
export function surfaceForPath(pathname: string): SurfaceKey | null {
  if (pathname === "/pos" || pathname.startsWith("/pos/")) return "pos";
  if (pathname === "/kds" || pathname.startsWith("/kds/")) return "kds";
  if (pathname === "/kot" || pathname.startsWith("/kot/")) return "kot";
  if (pathname === "/dispatch" || pathname.startsWith("/dispatch/")) return "dispatch";
  if (pathname === "/rider" || pathname.startsWith("/rider/")) return "rider";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return null;
}

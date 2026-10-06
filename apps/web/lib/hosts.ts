/**
 * Hostname → surface resolution (single-app multi-subdomain architecture).
 *
 * One Next.js app serves every pixaPOS product; the hostname selects which
 * internal route the bare `/` resolves to. Only the bare path rewrites —
 * deep links, assets and API routes pass through untouched on every host.
 *
 * Environment-aware: production (`pixapos.store`), branch previews
 * (`dev.pixapos.store`), local HTTPS (`local.pixapos.store`), plain
 * localhost, and `*.vercel.app` previews all parse without hardcoding a
 * single domain through the codebase. Override the base via
 * `NEXT_PUBLIC_BASE_DOMAIN`.
 *
 * Unknown subdomains resolve to null (pass through to normal routing, which
 * serves `/` marketing) — never a redirect, never an internal leak.
 */

const KNOWN_BASES = [
  process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "",
  "pixapos.store",
  "develop.pixapos.store",
  "dev.pixapos.store",
  "local.pixapos.store",
]
  .filter(Boolean)
  // Longest first: dev/local bases must win over the bare parent domain,
  // otherwise kds.dev.pixapos.store parses as sub="kds.dev" and misses.
  .sort((a, b) => b.length - a.length);

/** Subdomain key → internal route. "" and "www" are the marketing site. */
const SURFACE_MAP: Record<string, string> = {
  "": "/",
  www: "/",
  admin: "/admin",
  app: "/dashboard",
  pos: "/pos",
  captain: "/pos",
  kot: "/kot",
  kds: "/kds",
  kiosk: "/kiosk",
  // order.* is the public storefront route (reuses the QR shell for now);
  // /qr keeps working for installed PWAs and scanned table codes.
  order: "/order",
  qr: "/qr",
  shop: "/shop",
};

/** Local/preview hosts that never rewrite (dev paths + branch previews). */
function isBypassHost(host: string): boolean {
  return (
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".vercel.app")
  );
}

/**
 * Resolve the internal route for a request host's bare `/`.
 * Returns null when no rewrite applies (local dev, previews, unknown).
 */
export function resolveSurfaceRoute(hostHeader: string | null): string | null {
  const host = (hostHeader ?? "").split(":")[0].toLowerCase();
  if (!host || isBypassHost(host)) return null;
  for (const base of KNOWN_BASES) {
    if (host === base) return SURFACE_MAP[""];
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, -(base.length + 1));
      // Single-level subdomains only (a.b.pixapos.store stays manual).
      if (sub && !sub.includes(".")) {
        return SURFACE_MAP[sub] ?? null;
      }
      return null;
    }
  }
  // Unknown host entirely (LAN IPs, custom domains): no rewrite.
  return null;
}

/** True when the host participates in surface routing at all. */
export function isSurfaceHost(hostHeader: string | null): boolean {
  const host = (hostHeader ?? "").split(":")[0].toLowerCase();
  if (!host || isBypassHost(host)) return false;
  return KNOWN_BASES.some((base) => host === base || host.endsWith(`.${base}`));
}

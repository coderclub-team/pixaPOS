"use client";

/**
 * LAN hub addressing (P2 foundation). The hub is the same Next build running
 * on the counter PC; tablets/phones pair to it over WiFi so orders, KOTs,
 * payments and print keep flowing with no internet. A browser PWA cannot
 * accept inbound connections, which is why the hub must be a real server
 * process — never another tablet.
 *
 * Resolution order: explicit localStorage override (settings / QR pairing)
 * → NEXT_PUBLIC_HUB_URL build default → null (cloud origin).
 * Origin switching for every service call + device identity land next; this
 * module owns address resolution, reachability probing, and pairing codes.
 */

const HUB_URL_KEY = "pixaHubUrl";

export function getHubUrl(): string | null {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(HUB_URL_KEY);
      if (stored) return stored.replace(/\/$/, "");
    } catch {}
  }
  const env = process.env.NEXT_PUBLIC_HUB_URL;
  return env ? env.replace(/\/$/, "") : null;
}

export function setHubUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!url) window.localStorage.removeItem(HUB_URL_KEY);
    else window.localStorage.setItem(HUB_URL_KEY, url.replace(/\/$/, ""));
  } catch {}
}

/** Prefix an API path with the hub origin when one is configured. */
export function apiUrl(path: string): string {
  const hub = getHubUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return hub ? `${hub}${clean}` : clean;
}

export type HubHealth = {
  ok: boolean;
  app?: string;
  mode?: string;
  time?: string;
};

/** Probe a hub candidate. Returns null when unreachable (offline / wrong URL). */
export async function checkHub(url: string, timeoutMs = 4000): Promise<HubHealth | null> {
  const clean = url.replace(/\/$/, "");
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${clean}/api/health`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as HubHealth | null;
    return body && body.ok ? body : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 6-digit pairing code shown on the hub for tablets to join (validated hub-side). */
export function newPairingCode(): string {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

/**
 * Device sessions for offline operation (pair once, grace while offline).
 * HS256 JWT signed with BETTER_AUTH_SECRET — verifiable without any DB hit
 * via WebCrypto (Edge + Node + browser safe, zero deps).
 *
 * Semantics (fail-closed, never a bypass):
 * - The device cookie is consulted ONLY when the primary Better Auth
 *   session lookup throws (IdP/DB unreachable = offline signal). An
 *   online-but-anonymous request still redirects to sign-in.
 * - Tokens live 7 days; every action records the embedded actor identity.
 * - Kiosk tokens carry no user — outlet-scoped, capability-limited.
 */
export const DEVICE_COOKIE = "pixa_device";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DeviceClaims = {
  device_id: string;
  user_id?: string;
  org_id?: string | null;
  role?: string | null;
  kiosk?: boolean;
  outlet_id?: string | null;
  iat: number;
  exp: number;
};

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`pixa-device-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signDeviceToken(
  claims: Omit<DeviceClaims, "iat" | "exp">,
  ttlMs = TOKEN_TTL_MS,
): Promise<string> {
  const now = Date.now();
  const body: DeviceClaims = { ...claims, iat: now, exp: now + ttlMs };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload)),
  );
  return `${payload}.${b64urlEncode(sig)}`;
}

/** Null on any failure (bad shape, bad signature, expired). Never throws. */
export async function verifyDeviceToken(token: string): Promise<DeviceClaims | null> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as DeviceClaims;
    if (typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    if (!claims.device_id) return null;
    return claims;
  } catch {
    return null;
  }
}

export function readDeviceCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === DEVICE_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** SHA-256 hex for kiosk PIN storage (salt = outlet id, server-side only). */
export async function hashKioskPin(pin: string, outletId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`pixa-kiosk:${outletId}:${pin}`),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

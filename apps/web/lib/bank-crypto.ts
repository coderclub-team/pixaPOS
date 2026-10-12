/**
 * AES-GCM encryption for sensitive payroll fields (bank account numbers).
 * WebCrypto only — works in Node 22, Edge, and browsers with zero deps.
 * Key = SHA-256("pixa-bank-v1:" + BETTER_AUTH_SECRET), same pattern as
 * device-token.ts. Ciphertext format: base64(iv12 || ciphertext).
 */
async function bankKey(): Promise<CryptoKey> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`pixa-bank-v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt a bank account string. Returns base64 or null for empty input. */
export async function encryptBankAccount(plain: string | null | undefined): Promise<string | null> {
  if (!plain || !plain.trim()) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await bankKey(),
      new TextEncoder().encode(plain.trim()),
    ),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return b64encode(out);
}

/** Decrypt a value produced by encryptBankAccount. Null in, null out. */
export async function decryptBankAccount(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  const raw = b64decode(enc);
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await bankKey(), ct);
  return new TextDecoder().decode(pt);
}

/** Last-4 masked display — the only bank form ever shown in UI. */
export function maskBankAccount(last4: string | null | undefined): string {
  if (!last4) return "—";
  return `•••• ${last4.slice(-4)}`;
}

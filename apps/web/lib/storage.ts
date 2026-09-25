import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

const BUCKET = process.env.PIXA_IMAGE_BUCKET ?? "menu-images";

let cached: Files | null = null;

function files() {
  if (!cached) cached = new Files({ adapter: neon({ bucket: BUCKET }) });
  return cached;
}

/**
 * Upload route plumbing (server-only): validates menu-image constraints and
 * stores to the Neon `menu-images` bucket. Keys are versioned per upload
 * (`<kind>/<uuid>.<ext>`) so cached objects never go stale.
 */
export async function uploadMenuImage(kind: string, file: File): Promise<string> {
  const safeKind = /^[a-z-]+$/.test(kind) ? kind : "misc";
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${safeKind}/${crypto.randomUUID()}.${ext || "jpg"}`;
  await files().upload(key, file, { contentType: file.type || "image/jpeg" });
  return key;
}

/** Presigned read URL for a stored key (private bucket). */
export async function menuImageUrl(key: string, expiresIn = 3600): Promise<string> {
  return files().url(key, { expiresIn });
}

const LOGO_BUCKET = "outlet-assets";

let logoCached: Files | null = null;

function logoFiles() {
  if (!logoCached) logoCached = new Files({ adapter: neon({ bucket: LOGO_BUCKET }) });
  return logoCached;
}

function publicUrl(key: string): string {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, "");
  if (!endpoint) throw new Error("storage endpoint not configured");
  return `${endpoint}/${LOGO_BUCKET}/${key}`;
}

/**
 * Menu/category/recipe/waste image upload (server-only). The old private
 * `menu-images` bucket forced 1-hour presigned URLs into menu rows, so
 * product images broke an hour after upload. Uploads now go to the
 * public-read `outlet-assets` bucket (`menu-images/<kind>/…`) and return a
 * durable public URL — same pattern as the outlet logo. Keys are versioned
 * per upload (`<kind>/<uuid>.<ext>`) so cached objects never go stale.
 */
export async function uploadMenuImage(kind: string, file: File): Promise<string> {
  const safeKind = /^[a-z-]+$/.test(kind) ? kind : "misc";
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `menu-images/${safeKind}/${crypto.randomUUID()}.${ext || "jpg"}`;
  await logoFiles().upload(key, file, { contentType: file.type || "image/jpeg" });
  return publicUrl(key);
}

/**
 * Outlet logo upload (server-only): validates logo constraints and stores to
 * the public-read `outlet-assets` bucket. Keys are versioned per upload
 * (`logos/<outlet>/<uuid>.<ext>`) so cached objects never go stale.
 * Returns the public URL — safe to persist on the outlet and print on bills.
 */
export async function uploadOutletLogo(outletId: string, file: File): Promise<string> {
  const safeOutlet = /^[a-z0-9_-]+$/i.test(outletId) ? outletId : "default";
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `logos/${safeOutlet}/${crypto.randomUUID()}.${ext || "jpg"}`;
  await logoFiles().upload(key, file, { contentType: file.type || "image/jpeg" });
  return publicUrl(key);
}

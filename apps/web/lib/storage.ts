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

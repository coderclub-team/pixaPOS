import { NextResponse } from "next/server";
import { uploadMenuImage, menuImageUrl } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/uploads — multipart `file` + `kind` (menu-item, category,
 * recipe, waste). Validates type/size server-side, stores to the public-read
 * Neon `outlet-assets` bucket, returns the durable public URL. Callers
 * persist that URL string — no expiring presigned URLs in stored rows.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "misc");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file attached" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, or WebP images" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Max 5MB per image" }, { status: 400 });
  }
  try {
    const url = await uploadMenuImage(kind, file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 },
    );
  }
}

/**
 * GET /api/uploads?key=… — legacy presigned read URL for keys stored when the
 * bucket was private. New uploads return durable public URLs from POST, so
 * this is only a fallback for old rows.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  try {
    const url = await menuImageUrl(key);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Presign failed" },
      { status: 502 },
    );
  }
}

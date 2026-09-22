import { NextResponse } from "next/server";
import { uploadOutletLogo } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/outlet-logo — multipart `file` (+ optional `outlet_id`).
 * Validates type/size server-side, stores to the public-read Neon
 * `outlet-assets` bucket, returns the durable public URL. The outlet form
 * persists that URL string — no File objects ever touch the outlet store.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  const outletId = String(form.get("outlet_id") ?? "default");
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
    const url = await uploadOutletLogo(outletId, file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 },
    );
  }
}

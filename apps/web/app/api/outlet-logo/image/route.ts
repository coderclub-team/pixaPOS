import { NextResponse } from "next/server";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * GET /api/outlet-logo/image?url=<https-url> — same-origin image proxy for
 * logo rasterization. The Neon bucket sends no CORS headers, so browser
 * canvas reads must go through here (server-side fetch has no CORS).
 * Strict allowlist: https + Neon storage hosts + image content only.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "https only" }, { status: 400 });
  }
  if (!parsed.hostname.endsWith(".neon.tech")) {
    return NextResponse.json({ error: "untrusted host" }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(15000) });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 400 });
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 400 });
  }
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

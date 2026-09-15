import { NextResponse } from "next/server";

const ENABLED = process.env.PIXA_SYNC_ENABLED === "true";

/**
 * Sync pull skeleton: returns canonical rows newer than the client's cursor.
 * Entity hydration lands in pilot phases — until then it returns an empty
 * page with the echoed cursor so clients can exercise the cursor protocol.
 */
export async function GET(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ error: "sync disabled" }, { status: 503 });
  }
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type") ?? "";
  const cursor = url.searchParams.get("cursor") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
  if (!entityType) {
    return NextResponse.json({ error: "entity_type is required" }, { status: 400 });
  }
  void limit;
  return NextResponse.json({
    entity_type: entityType,
    rows: [],
    cursor,
    has_more: false,
  });
}

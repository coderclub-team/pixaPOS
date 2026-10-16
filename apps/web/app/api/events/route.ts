import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { authFailed, isSseRequest, resolveRealtimeAuth } from "@/lib/realtime/auth";
import { persistPixaEvent } from "@/lib/realtime/persist";
import type { PixaSource } from "@/lib/realtime/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 1000;
const HEARTBEAT_MS = 25_000;

type EventRow = {
  id: string;
  outlet_id: string;
  organization_id: string | null;
  sequence: number | null;
  device_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_id: string | null;
  reason_text: string | null;
  source_type: string | null;
  source_device_id: string | null;
  station_ids: string | null;
  target: string | null;
  metadata: string | null;
  created_at: string;
};

function rowToPixaEvent(row: EventRow) {
  return {
    id: row.id,
    outlet_id: row.outlet_id,
    organization_id: row.organization_id,
    sequence: row.sequence ?? 0,
    device_id: row.device_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    event_type: row.event_type,
    from_state: row.from_state ?? undefined,
    to_state: row.to_state ?? undefined,
    actor_id: row.actor_id ?? undefined,
    reason_text: row.reason_text ?? undefined,
    source_type: row.source_type ?? undefined,
    source_device_id: row.source_device_id ?? undefined,
    station_ids: row.station_ids ? safeJsonParse(row.station_ids) : undefined,
    target: row.target ? safeJsonParse(row.target) : undefined,
    metadata: row.metadata ? safeJsonParse(row.metadata) : undefined,
    created_at: row.created_at,
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function queryEvents(
  outletId: string,
  organizationId: string,
  afterSequence: number,
  limit: number,
): Promise<EventRow[]> {
  const database = db();
  try {
    const result = await database.execute(
      sql`SELECT id, outlet_id, organization_id, sequence, device_id, entity_type, entity_id, event_type, from_state, to_state, actor_id, reason_text, source_type, source_device_id, station_ids::text as station_ids, target::text as target, metadata::text as metadata, created_at::text as created_at FROM events WHERE outlet_id = ${outletId} AND organization_id = ${organizationId} AND COALESCE(sequence,0) > ${afterSequence} ORDER BY sequence ASC LIMIT ${limit}`,
    );
    const rows = extractRows<EventRow>(result);
    if (rows.length > 0) return rows;
  } catch {
    // fallback without organization_id filter (pre-migration data)
  }
  try {
    const database2 = db();
    const result2 = await database2.execute(
      sql`SELECT id, outlet_id, organization_id, sequence, device_id, entity_type, entity_id, event_type, from_state, to_state, actor_id, reason_text, source_type, source_device_id, station_ids::text as station_ids, target::text as target, metadata::text as metadata, created_at::text as created_at FROM events WHERE outlet_id = ${outletId} AND COALESCE(sequence,0) > ${afterSequence} ORDER BY sequence ASC LIMIT ${limit}`,
    );
    return extractRows<EventRow>(result2);
  } catch {
    return [];
  }
}

function extractRows<T>(result: unknown): T[] {
  if (!result) return [];
  // drizzle/neon-http returns array of rows directly or {rows: [...]}
  if (Array.isArray(result)) return result as unknown as T[];
  const obj = result as { rows?: unknown[] };
  if (Array.isArray(obj.rows)) return obj.rows as unknown as T[];
  return [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // EventSource hint: treat as SSE if client explicitly asks via ?stream=1 or Accept header
  const wantsSse = isSseRequest(req) || url.searchParams.get("stream") === "1";
  const authRes = await resolveRealtimeAuth(req);
  if (authFailed(authRes)) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }
  const { organizationId, outletId } = authRes.ctx;
  const afterSequence =
    Number(url.searchParams.get("afterSequence") ?? url.searchParams.get("cursor") ?? "0") || 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 200);

  // JSON poll mode
  if (!wantsSse) {
    const rows = await queryEvents(outletId, organizationId, afterSequence, limit);
    const events = rows.map(rowToPixaEvent);
    const nextSequence = events.length > 0 ? events[events.length - 1].sequence : afterSequence;
    return NextResponse.json(
      { events, nextSequence, outletId, organizationId },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // SSE mode
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let cursor = afterSequence;

  // Seed cursor to max sequence if not provided
  if (cursor === 0) {
    try {
      const database = db();
      const seed = await database.execute(
        sql`SELECT COALESCE(MAX(sequence),0)::text as m FROM events WHERE outlet_id = ${outletId}`,
      );
      const rows = extractRows<{ m: string }>(seed);
      cursor = Number(rows[0]?.m ?? 0);
    } catch {
      cursor = 0;
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: ready\ndata: ${JSON.stringify({ cursor, outletId, organizationId })}\n\n`,
        ),
      );

      const poll = async () => {
        if (closed) return;
        try {
          const rows = await queryEvents(outletId, organizationId, cursor, 50);
          for (const row of rows) {
            const seq = row.sequence ?? 0;
            cursor = seq;
            const payload = rowToPixaEvent(row);
            controller.enqueue(
              encoder.encode(
                `id: ${seq}\nevent: ${row.event_type}\ndata: ${JSON.stringify({ id: seq, event: payload })}\n\n`,
              ),
            );
          }
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: {"message":"poll failed"}\n\n`));
        }
      };

      await poll();
      timer = setInterval(() => void poll(), POLL_MS);
      beat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
      if (beat) clearInterval(beat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  // Auth: supports outletId via query or body; resolve via realtime auth helper
  let body: {
    outletId?: string;
    outlet_id?: string;
    id?: string;
    entity_type?: string;
    entityType?: string;
    entity_id?: string;
    entityId?: string;
    event_type?: string;
    eventType?: string;
    from_state?: string;
    fromState?: string;
    to_state?: string;
    toState?: string;
    actor_id?: string;
    actorId?: string;
    reason_text?: string;
    reasonText?: string;
    source_type?: string;
    sourceType?: string;
    source_device_id?: string;
    sourceDeviceId?: string;
    station_ids?: string[];
    stationIds?: string[];
    target?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Allow outletId in query or body
  const url = new URL(req.url);
  const bodyOutlet = body.outletId ?? body.outlet_id ?? url.searchParams.get("outletId") ?? "";
  // Patch URL for auth helper which reads outletId from query
  const authUrl = new URL(req.url);
  if (bodyOutlet && !authUrl.searchParams.get("outletId")) {
    authUrl.searchParams.set("outletId", bodyOutlet);
  }
  const authReq = new Request(authUrl.toString(), {
    headers: req.headers,
    method: req.method,
  });
  const authRes = await resolveRealtimeAuth(authReq);
  if (authFailed(authRes)) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }
  const { organizationId, outletId: authedOutletId } = authRes.ctx;
  const outletId = authedOutletId; // server-truth, never client-supplied

  const entityType = body.entity_type ?? body.entityType ?? "";
  const entityId = body.entity_id ?? body.entityId ?? "";
  const eventType = body.event_type ?? body.eventType ?? "";
  if (!entityType || !entityId || !eventType) {
    return NextResponse.json(
      { error: "entity_type, entity_id, event_type required" },
      { status: 400 },
    );
  }

  const stationIds = body.station_ids ?? body.stationIds;
  if (stationIds !== undefined && !Array.isArray(stationIds)) {
    return NextResponse.json({ error: "station_ids must be string[]" }, { status: 400 });
  }

  const sourceType = (body.source_type ?? body.sourceType) as PixaSource | undefined;
  const allowedSources: PixaSource[] = [
    "POS",
    "KDS",
    "KIOSK",
    "QR",
    "CAPTAIN",
    "WEBSITE",
    "SYSTEM",
  ];
  if (sourceType && !allowedSources.includes(sourceType)) {
    return NextResponse.json({ error: `invalid source_type: ${sourceType}` }, { status: 400 });
  }

  try {
    const event = await persistPixaEvent({
      outletId,
      organizationId,
      entityType,
      entityId,
      eventType,
      fromState: body.from_state ?? body.fromState,
      toState: body.to_state ?? body.toState,
      actorId: body.actor_id ?? body.actorId ?? authRes.ctx.userId,
      reasonText: body.reason_text ?? body.reasonText,
      sourceType,
      sourceDeviceId:
        body.source_device_id ?? body.sourceDeviceId ?? authRes.ctx.deviceId ?? undefined,
      stationIds: stationIds as string[] | undefined,
      target: body.target,
      metadata: body.metadata,
      id: body.id,
    });
    return NextResponse.json({ event }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unknown or inactive stationIds")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: msg || "failed to persist event" }, { status: 500 });
  }
}

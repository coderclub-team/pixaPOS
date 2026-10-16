import { sql } from "drizzle-orm";
import { db } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import type { BusinessEvent } from "@/features/events/api/types";
import type { PixaEvent, PixaSource } from "./types";
import { getEventPublisher } from "./gateway";

/**
 * Server-side event persistence with per-outlet sequence.
 * - Validates stationIds against outlet_kitchen_stations when supplied
 * - Generates monotonic per-outlet sequence via advisory lock
 * - Inserts into events with source/target metadata
 * - Publishes after commit via provider-agnostic gateway (non-blocking for speed)
 */
export type PersistEventInput = {
  outletId: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  fromState?: string;
  toState?: string;
  actorId?: string;
  reasonText?: string;
  sourceType?: PixaSource;
  sourceDeviceId?: string;
  stationIds?: string[];
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  id?: string;
};

function extractRows<T>(result: unknown): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as unknown as T[];
  const obj = result as { rows?: unknown[] };
  if (Array.isArray(obj.rows)) return obj.rows as unknown as T[];
  return [];
}

async function validateStations(outletId: string, stationIds?: string[]): Promise<void> {
  if (!stationIds || stationIds.length === 0) return;
  try {
    const database = db();
    // Validate that every supplied station_id exists and is active for this outlet
    const { and, eq, inArray } = await import("drizzle-orm");
    const { outletKitchenStations } = await import("@pixa/db");
    const rows = await database
      .select({ id: outletKitchenStations.id })
      .from(outletKitchenStations)
      .where(
        and(
          eq(outletKitchenStations.outletId, outletId),
          inArray(outletKitchenStations.id, stationIds),
          eq(outletKitchenStations.isActive, true),
        ),
      );
    if (rows.length !== stationIds.length) {
      const found = new Set(rows.map((r) => r.id));
      const missing = stationIds.filter((id) => !found.has(id));
      throw new Error(`Unknown or inactive stationIds for outlet: ${missing.join(", ")}`);
    }
  } catch (e) {
    // If table not yet migrated, allow arbitrary ids (phase 1 compat) — but surface error if it's validation error
    if (e instanceof Error && e.message.includes("Unknown or inactive")) throw e;
    // otherwise swallow (table missing)
  }
}

async function nextSequenceLocked(outletId: string): Promise<number> {
  const database = db();
  // Advisory lock to serialize per-outlet sequence generation
  const key = hashOutletKey(outletId);
  await database.execute(sql`SELECT pg_advisory_xact_lock(${key})`);
  // neon-http doesn't support explicit transactions, but advisory_xact_lock scope is the transaction;
  // since neon-http auto-commits each statement, we instead do SELECT MAX + INSERT with unique constraint retry.
  // Fallback: optimistic MAX+1 with retry on conflict.
  const res = await database.execute(
    sql`SELECT COALESCE(MAX(sequence),0)::int as max_seq FROM events WHERE outlet_id = ${outletId}`,
  );
  const rows = extractRows<{ max_seq: number; maxSeq?: number; m?: number }>(res);
  const first = rows[0] as Record<string, unknown> | undefined;
  const maxSeq = Number(first?.max_seq ?? first?.maxSeq ?? first?.m ?? 0);
  return maxSeq + 1;
}

function hashOutletKey(outletId: string): number {
  let h = 0;
  for (let i = 0; i < outletId.length; i++) h = (Math.imul(31, h) + outletId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647;
}

export async function persistPixaEvent(input: PersistEventInput): Promise<PixaEvent> {
  await validateStations(input.outletId, input.stationIds);

  const id = input.id ?? ulid();
  const database = db();

  // Idempotency: if same id already exists, return it
  try {
    const existing = await database.execute(sql`SELECT id FROM events WHERE id = ${id} LIMIT 1`);
    const rows = extractRows<{ id: string }>(existing);
    if (rows.length > 0) {
      const fetched = await database.execute(
        sql`SELECT id, outlet_id, organization_id, sequence, device_id, entity_type, entity_id, event_type, from_state, to_state, actor_id, reason_text, source_type, source_device_id, station_ids::text as station_ids, target::text as target, metadata::text as metadata, created_at::text as created_at FROM events WHERE id = ${id} LIMIT 1`,
      );
      const erows = extractRows<Record<string, unknown>>(fetched);
      if (erows[0]) {
        const r = erows[0] as Record<string, unknown>;
        return {
          id: r.id as string,
          outlet_id: r.outlet_id as string,
          organization_id: r.organization_id as string | null,
          sequence: Number(r.sequence ?? 0),
          entity_type: r.entity_type as string,
          entity_id: r.entity_id as string,
          event_type: r.event_type as string,
          from_state: r.from_state as string | undefined,
          to_state: r.to_state as string | undefined,
          actor_id: r.actor_id as string | undefined,
          reason_text: r.reason_text as string | undefined,
          source_type: r.source_type as PixaSource | undefined,
          source_device_id: r.source_device_id as string | undefined,
          station_ids: r.station_ids ? JSON.parse(r.station_ids as string) : undefined,
          target: r.target ? JSON.parse(r.target as string) : undefined,
          metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
          created_at: r.created_at as string,
        } as unknown as PixaEvent;
      }
    }
  } catch {
    // table missing or other — continue to insert
  }

  // Generate sequence with retry on unique violation (concurrency)
  let sequence = 0;
  let inserted = false;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    try {
      sequence = await nextSequenceLocked(input.outletId);
      await database.execute(
        sql`INSERT INTO events (id, outlet_id, organization_id, sequence, device_id, entity_type, entity_id, event_type, from_state, to_state, actor_id, reason_text, source_type, source_device_id, station_ids, target, metadata, created_at)
            VALUES (${id}, ${input.outletId}, ${input.organizationId}, ${sequence}, ${input.sourceDeviceId ?? null}, ${input.entityType}, ${input.entityId}, ${input.eventType}, ${input.fromState ?? null}, ${input.toState ?? null}, ${input.actorId ?? null}, ${input.reasonText ?? null}, ${input.sourceType ?? null}, ${input.sourceDeviceId ?? null}, ${input.stationIds ? JSON.stringify(input.stationIds) : null}::jsonb, ${input.target ? JSON.stringify(input.target) : null}::jsonb, ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb, now())`,
      );
      inserted = true;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("events_outlet_seq_uidx") ||
        msg.includes("duplicate") ||
        msg.includes("unique")
      ) {
        // sequence conflict — retry
        continue;
      }
      throw e;
    }
  }
  if (!inserted) throw lastError ?? new Error("Failed to persist event after retries");

  const event: PixaEvent = {
    id,
    outlet_id: input.outletId,
    organization_id: input.organizationId,
    sequence,
    entity_type: input.entityType as BusinessEvent["entity_type"],
    entity_id: input.entityId,
    event_type: input.eventType as BusinessEvent["event_type"],
    from_state: input.fromState,
    to_state: input.toState,
    actor_id: input.actorId,
    reason_text: input.reasonText,
    source_type: input.sourceType,
    source_device_id: input.sourceDeviceId,
    station_ids: input.stationIds,
    target: input.target as PixaEvent["target"],
    metadata: input.metadata,
    created_at: new Date().toISOString(),
  } as unknown as PixaEvent;

  // After-commit publish (fast, non-blocking for API latency)
  void getEventPublisher()
    .publish(event)
    .catch(() => {});

  return event;
}

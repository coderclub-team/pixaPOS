/**
 * Server-side business event writer (Postgres `events` table).
 * Mirrors the local recordEvent contract minus offline plumbing: no SQLite,
 * no outbox, no cross-tab notify. Sequence stays null — realtime gap-fill
 * assigns it when that path is re-enabled.
 *
 * Server-only: import from API routes, never from client components.
 */
import { db, events } from "@pixa/db";
import { ulid } from "@pixa/contracts";

export type ServerRecordEventInput = {
  outlet_id: string;
  organization_id?: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  from_state?: string | null;
  to_state?: string | null;
  actor_id?: string | null;
  reason_code?: string | null;
  reason_text?: string | null;
  metadata?: Record<string, unknown> | null;
  source_type?: string | null;
  station_ids?: string[] | null;
};

export async function recordServerEvent(input: ServerRecordEventInput): Promise<{ id: string }> {
  const [row] = await db()
    .insert(events)
    .values({
      id: ulid(),
      outletId: input.outlet_id,
      organizationId: input.organization_id ?? null,
      entityType: input.entity_type,
      entityId: input.entity_id,
      eventType: input.event_type,
      fromState: input.from_state ?? null,
      toState: input.to_state ?? null,
      actorId: input.actor_id ?? null,
      reasonCode: input.reason_code ?? null,
      reasonText: input.reason_text ?? null,
      sourceType: input.source_type ?? null,
      stationIds: input.station_ids ?? null,
      metadata: (input.metadata ?? null) as Record<string, unknown> | null,
    })
    .returning({ id: events.id })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      // Events are audit trail, never load-bearing: log and continue.
      // eslint-disable-next-line no-console
      console.warn("[events] append failed (non-fatal):", msg.slice(0, 200));
      return [] as { id: string }[];
    });
  return { id: row?.id ?? "unknown" };
}

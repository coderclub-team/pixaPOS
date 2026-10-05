import { delay } from "@/constants/mock-api";
import { ulid } from "@pixa/contracts";
import type { BusinessEvent, BusinessEventType, EntityType, EventFilters } from "./types";
import { deviceId } from "@/lib/db/device";
import { appendOutbox } from "@/lib/db/outbox";
import { initLocalDb, localExec, localQuery } from "@/lib/db/sqlite";

const EVENT_STORAGE_KEY = "pixaEvents";
/** Bump key: SQLite writers touch this so other tabs refetch via storage events. */
const LOCAL_DB_BUMP_KEY = "pixaLocalDbBump";

let mockEvents: BusinessEvent[] = [];
let migrated = false;

function saveEvents() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify({ events: mockEvents }));
    } catch {}
  }
}

function loadEvents(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(EVENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.events)) mockEvents = parsed.events;
      }
    } catch {}
  }
}
loadEvents();

function bumpTabs() {
  try {
    localStorage.setItem(LOCAL_DB_BUMP_KEY, String(Date.now()));
  } catch {}
}

function rowToEvent(row: unknown[]): BusinessEvent {
  const [
    id,
    outlet_id,
    device_id,
    entity_type,
    entity_id,
    event_type,
    from_state,
    to_state,
    actor_id,
    reason_text,
    metadata,
    created_at,
  ] = row as (string | null)[];
  return {
    id: id as string,
    outlet_id: outlet_id as string,
    entity_type: entity_type as EntityType,
    entity_id: entity_id as string,
    event_type: event_type as BusinessEventType,
    from_state: from_state ?? undefined,
    to_state: to_state ?? undefined,
    actor_id: actor_id ?? undefined,
    reason_text: reason_text ?? undefined,
    metadata: metadata ? JSON.parse(metadata) : undefined,
    created_at: created_at as string,
  };
}

/**
 * One-time import: existing localStorage audit history moves into SQLite so
 * the timeline never loses rows at cutover. Guarded by kv_meta flag.
 */
async function migrateOnce(): Promise<void> {
  if (migrated) return;
  migrated = true;
  const { rows } = await localQuery("SELECT value FROM kv_meta WHERE key = 'events_migrated'");
  if (rows.length > 0) return;
  loadEvents();
  for (const e of mockEvents) {
    await localExec(
      `INSERT OR IGNORE INTO events
        (id, outlet_id, device_id, entity_type, entity_id, event_type,
         from_state, to_state, actor_id, reason_text, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.outlet_id,
        null,
        e.entity_type,
        e.entity_id,
        e.event_type,
        e.from_state ?? null,
        e.to_state ?? null,
        e.actor_id ?? null,
        e.reason_text ?? null,
        e.metadata ? JSON.stringify(e.metadata) : null,
        e.created_at,
      ],
    );
  }
  await localExec("INSERT INTO kv_meta (key, value) VALUES ('events_migrated', '1')");
}

async function useSqlite(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const mode = await initLocalDb();
    if (mode !== "sqlite") return false;
    await migrateOnce();
    return true;
  } catch {
    return false;
  }
}

/**
 * Outbox gate: zero-KOT orders never leave the device. Draft creation,
 * edits and discards stay local-only (audited in SQLite, never synced) —
 * only the first fire and everything after it enqueues. Fail-open: a
 * lookup failure must never silently drop server data.
 */
/**
 * Outbox gate + state-snapshot fan-out. Every mutation in orders, kitchen
 * and payments already funnels through recordEvent, so this is the single
 * choke point for sync — no per-mutation call sites needed:
 * - ORDER entities for ineligible orders (zero-KOT drafts, deleted) stay
 *   local-only: audit row written, nothing enqueued. Fail-open on lookup
 *   error so server data is never silently dropped.
 * - TABLE / OCCUPANCY_GROUP / RESERVATION entities stay local-only for now
 *   (their sync application lands with the tables cutover).
 * - Eligible ORDER events enqueue the audit event plus a current ORDER
 *   snapshot (CREATE on ORDER_CREATED, else UPDATE).
 * - Events carrying metadata.kot_id additionally enqueue the current KOT
 *   snapshot, so kitchen state travels with its audit trail.
 * - PAYMENT entities always sync (money never stays silent) with snapshot.
 * - `event` entities always sync (audit trail).
 */
async function appendOutboxGate(event: BusinessEvent): Promise<void> {
  const queueEvent = async () => {
    await appendOutbox({
      outlet_id: event.outlet_id,
      entity_type: "event",
      entity_id: event.id,
      operation: "CREATE",
      payload: { ...event },
      actor_id: event.actor_id ?? "staff",
    }).catch((e) => {
      // The audit row above is already durable. A failed outbox write must
      // never roll back the business mutation it audits — log loudly so the
      // gap is visible, and let the outbox retry sweeper (pilot) pick it up.
      console.error("[events] outbox append failed for", event.id, e);
    });
  };

  if (event.entity_type === "ORDER") {
    let eligible = true;
    let snapshot: unknown = null;
    try {
      const svc = await import("@/features/orders/api/service");
      eligible = svc.orderSyncEligible(event.entity_id);
      if (eligible) snapshot = svc.getOrderForSync(event.entity_id);
    } catch {
      // Fail-open by design (see above).
    }
    if (!eligible || !snapshot) return;
    await queueEvent();
    await appendOutbox({
      outlet_id: event.outlet_id,
      entity_type: "ORDER",
      entity_id: event.entity_id,
      operation: event.event_type === "ORDER_CREATED" ? "CREATE" : "UPDATE",
      payload: { order: snapshot },
      actor_id: event.actor_id ?? "staff",
    }).catch((e) => {
      console.error("[events] outbox snapshot failed for order", event.entity_id, e);
    });
    const kotId = (event.metadata as { kot_id?: string } | undefined)?.kot_id;
    if (kotId) {
      try {
        const { getTicketForSync } = await import("@/features/kitchen/api/service");
        const ticket = getTicketForSync(kotId);
        if (ticket) {
          await appendOutbox({
            outlet_id: event.outlet_id,
            entity_type: "KOT",
            entity_id: kotId,
            operation: event.event_type === "ORDER_SENT_TO_KITCHEN" ? "CREATE" : "UPDATE",
            payload: { ticket },
            actor_id: event.actor_id ?? "staff",
          }).catch((e) => {
            console.error("[events] outbox snapshot failed for kot", kotId, e);
          });
        }
      } catch {
        // Fail-open: the ORDER snapshot above already carries the state.
      }
    }
    return;
  }

  if (event.entity_type === "PAYMENT") {
    await queueEvent();
    try {
      const { getPaymentForSync } = await import("@/features/payments/api/service");
      const found = getPaymentForSync(event.entity_id);
      if (found) {
        await appendOutbox({
          outlet_id: event.outlet_id,
          entity_type: found.kind,
          entity_id: event.entity_id,
          operation: "CREATE",
          payload: { [found.kind === "PAYMENT" ? "payment" : "refund"]: found.record },
          actor_id: event.actor_id ?? "staff",
        }).catch((e) => {
          console.error("[events] outbox snapshot failed for payment", event.entity_id, e);
        });
      }
    } catch {
      // Fail-open: the PAYMENT event above already carries order/method/amount.
    }
    return;
  }

  // TABLE, OCCUPANCY_GROUP, RESERVATION, CUSTOMER and anything else:
  // local audit row only, no outbox — their sync application is a later
  // cutover.
}

export async function recordEvent(params: {
  outlet_id: string;
  entity_type: EntityType;
  entity_id: string;
  event_type: BusinessEventType;
  from_state?: string;
  to_state?: string;
  actor_id?: string;
  reason_code?: string;
  reason_text?: string;
  metadata?: Record<string, any>;
}): Promise<BusinessEvent> {
  // Local-first path: durable SQLite row + pending outbox command, then notify tabs.
  if (await useSqlite()) {
    const event: BusinessEvent = {
      id: ulid(),
      ...params,
      created_at: new Date().toISOString(),
    };
    await localExec(
      `INSERT INTO events
        (id, outlet_id, device_id, entity_type, entity_id, event_type,
         from_state, to_state, actor_id, reason_text, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.outlet_id,
        deviceId(),
        event.entity_type,
        event.entity_id,
        event.event_type,
        event.from_state ?? null,
        event.to_state ?? null,
        event.actor_id ?? null,
        event.reason_text ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.created_at,
      ],
    );
    await appendOutboxGate(event);
    bumpTabs();
    return { ...event };
  }

  // Fallback path (no OPFS): legacy localStorage behavior, unchanged.
  const event: BusinessEvent = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    ...params,
    created_at: new Date().toISOString(),
  };
  mockEvents.push(event);
  saveEvents();
  return { ...event };
}

export async function getEvents(filters?: EventFilters): Promise<BusinessEvent[]> {
  await delay(200);
  if (await useSqlite()) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters?.outlet_id) {
      clauses.push("outlet_id = ?");
      params.push(filters.outlet_id);
    }
    if (filters?.entity_type) {
      clauses.push("entity_type = ?");
      params.push(filters.entity_type);
    }
    if (filters?.entity_id) {
      clauses.push("entity_id = ?");
      params.push(filters.entity_id);
    }
    if (filters?.event_type) {
      clauses.push("event_type = ?");
      params.push(filters.event_type);
    }
    if (filters?.date_from) {
      clauses.push("created_at >= ?");
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      clauses.push("created_at <= ?");
      params.push(filters.date_to);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await localQuery(
      `SELECT id, outlet_id, device_id, entity_type, entity_id, event_type,
              from_state, to_state, actor_id, reason_text, metadata, created_at
       FROM events ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map(rowToEvent);
  }
  loadEvents(); // localStorage is the shared source — reload so tabs/displays agree
  let result = [...mockEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (filters?.outlet_id) {
    result = result.filter((e) => e.outlet_id === filters.outlet_id);
  }
  if (filters?.entity_type) {
    result = result.filter((e) => e.entity_type === filters.entity_type);
  }
  if (filters?.entity_id) {
    result = result.filter((e) => e.entity_id === filters.entity_id);
  }
  if (filters?.event_type) {
    result = result.filter((e) => e.event_type === filters.event_type);
  }
  if (filters?.date_from) {
    result = result.filter((e) => e.created_at >= filters.date_from!);
  }
  if (filters?.date_to) {
    result = result.filter((e) => e.created_at <= filters.date_to!);
  }

  return result;
}

/**
 * Sync outbox writer (local SQLite). Every local mutation records a
 * command envelope here as `pending` BEFORE entity state changes, so an
 * interrupted write is always retryable and never silently lost.
 *
 * Foundation scope: helper only — service wiring lands in pilot phases.
 * A per-device monotonic sequence preserves causal order.
 */
import { ulid, type CommandEnvelope, type OutboxOperation } from "@pixa/contracts";
import { deviceId } from "./device";
import { initLocalDb, localExec, localQuery } from "./sqlite";

async function nextSeq(device: string): Promise<number> {
  const { rows } = await localQuery("SELECT value FROM kv_meta WHERE key = ?", [
    `device_seq:${device}`,
  ]);
  const safeRows = rows ?? [];
  const current = safeRows.length > 0 ? Number(safeRows[0][0]) : 0;
  const next = current + 1;
  await localExec(
    "INSERT INTO kv_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [`device_seq:${device}`, String(next)],
  );
  return next;
}

export async function appendOutbox(params: {
  outlet_id: string;
  entity_type: string;
  entity_id: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  actor_id: string;
}): Promise<CommandEnvelope> {
  const device = deviceId();
  const envelope: CommandEnvelope = {
    command_id: ulid(),
    device_id: device,
    outlet_id: params.outlet_id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    operation: params.operation,
    payload: params.payload,
    actor_id: params.actor_id,
    device_seq: await nextSeq(device),
    created_at: new Date().toISOString(),
  };
  await localExec(
    `INSERT INTO sync_outbox
      (command_id, device_id, outlet_id, entity_type, entity_id, operation,
       payload, actor_id, device_seq, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [
      envelope.command_id,
      envelope.device_id,
      envelope.outlet_id,
      envelope.entity_type,
      envelope.entity_id,
      envelope.operation,
      JSON.stringify(envelope.payload),
      envelope.actor_id,
      envelope.device_seq,
      envelope.created_at,
    ],
  );
  return envelope;
}

export async function pendingOutboxCount(): Promise<number> {
  const { rows } = await localQuery(
    "SELECT COUNT(*) FROM sync_outbox WHERE status = 'pending'",
    [],
  );
  return Number((rows ?? [])[0]?.[0] ?? 0);
}

/** Oldest pending commands first (causal order per device_seq). */
export async function pendingOutboxBatch(limit = 100): Promise<CommandEnvelope[]> {
  const { rows } = await localQuery(
    `SELECT command_id, device_id, outlet_id, entity_type, entity_id, operation,
            payload, actor_id, device_seq, created_at
     FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    [limit],
  );
  return (rows ?? []).map((r) => {
    const [
      command_id,
      device_id,
      outlet_id,
      entity_type,
      entity_id,
      operation,
      payload,
      actor_id,
      device_seq,
      created_at,
    ] = r as (string | number)[];
    return {
      command_id: command_id as string,
      device_id: device_id as string,
      outlet_id: outlet_id as string,
      entity_type: entity_type as string,
      entity_id: entity_id as string,
      operation: operation as OutboxOperation,
      payload: JSON.parse(payload as string),
      actor_id: actor_id as string,
      device_seq: device_seq as number,
      created_at: created_at as string,
    };
  });
}

/** Mark commands acknowledged by /api/sync/push as synced. */
export async function markOutboxSynced(commandIds: string[]): Promise<void> {
  if (commandIds.length === 0) return;
  const now = new Date().toISOString();
  for (const id of commandIds) {
    await localExec(
      "UPDATE sync_outbox SET status = 'synced', synced_at = ? WHERE command_id = ?",
      [now, id],
    );
  }
}

/**
 * Fire-and-forget entity envelope for domain commands. Never throws and
 * never blocks the business mutation — a mirror/outbox failure is logged
 * loudly (dev-visible) and the local mutation still succeeds. The sync
 * processor (pilot) drains pending rows; until then they accumulate safely.
 */
export async function emitEntityOp(params: {
  outlet_id: string;
  entity_type: string;
  entity_id: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  actor_id: string;
}): Promise<boolean> {
  try {
    if ((await initLocalDb()) !== "sqlite") return false;
    await appendOutbox(params);
    return true;
  } catch (e) {
    console.warn("[outbox] emitEntityOp failed for", params.entity_id, e);
    return false;
  }
}

/** Record a failed push attempt (retry bookkeeping for the processor loop). */
export async function markOutboxFailed(commandIds: string[], error: string): Promise<void> {
  if (commandIds.length === 0) return;
  for (const id of commandIds) {
    await localExec(
      "UPDATE sync_outbox SET retry_count = retry_count + 1, last_error = ? WHERE command_id = ?",
      [error.slice(0, 500), id],
    );
  }
}

/** Counts by status for the sync status UI. */
export async function outboxStatusCounts(): Promise<{
  pending: number;
  failed: number;
  synced: number;
}> {
  const { rows } = await localQuery(
    `SELECT status, COUNT(*) FROM sync_outbox WHERE status IN ('pending','failed','synced') GROUP BY status`,
    [],
  );
  const counts = { pending: 0, failed: 0, synced: 0 };
  for (const [status, n] of (rows ?? []) as [string, number][]) {
    if (status === "pending" || status === "failed" || status === "synced") {
      counts[status] = Number(n) || 0;
    }
  }
  return counts;
}

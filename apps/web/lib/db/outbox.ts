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
import { localExec, localQuery } from "./sqlite";

async function nextSeq(device: string): Promise<number> {
  const { rows } = await localQuery("SELECT value FROM kv_meta WHERE key = ?", [
    `device_seq:${device}`,
  ]);
  const current = rows.length > 0 ? Number(rows[0][0]) : 0;
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
  return Number(rows[0]?.[0] ?? 0);
}

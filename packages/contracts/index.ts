/**
 * @pixa/contracts — local-first domain contracts.
 *
 * Every local mutation is a Command: an idempotency-keyed envelope carrying a
 * ULID identity, device origin, and causal order. Commands durably land in the
 * sync outbox first; entity state follows. The server applies outbox batches
 * idempotently and returns canonical results or structured conflicts.
 *
 * Money/key rules (ADR-0001, arch doc §13-18):
 * - IDs are ULIDs (time-ordered, collision-free across offline devices).
 * - Payments are never silently overwritten; KOT events are preserved;
 *   inventory moves through transactions, never absolute overwrites.
 */

/** ULID: 26-char Crockford-base32, time-ordered, URL-safe. */
export type ULID = string;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RAND_LEN = 16;

let lastMs = 0;
let lastRand = new Array<number>(RAND_LEN).fill(0);

function randomNibble(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint8Array(1))[0] % 32;
  }
  return Math.floor(Math.random() * 32);
}

/** Monotonic ULID — safe under same-ms bursts on one device. */
export function ulid(atMs: number = Date.now()): ULID {
  if (atMs <= lastMs) {
    // Same ms (or clock step back): increment the random part.
    for (let i = RAND_LEN - 1; i >= 0; i--) {
      lastRand[i] = (lastRand[i] + 1) % 32;
      if (lastRand[i] !== 0) break;
    }
    atMs = lastMs;
  } else {
    lastMs = atMs;
    for (let i = 0; i < RAND_LEN; i++) lastRand[i] = randomNibble();
  }
  let time = atMs;
  let timePart = "";
  for (let i = 0; i < TIME_LEN; i++) {
    timePart = CROCKFORD[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  return timePart + lastRand.map((n) => CROCKFORD[n]).join("");
}

/** Milliseconds encoded in a ULID (for ordering/debugging). */
export function ulidTime(id: ULID): number {
  let ms = 0;
  for (let i = 0; i < TIME_LEN; i++) {
    ms = ms * 32 + CROCKFORD.indexOf(id[i]);
  }
  return ms;
}

export function isUlid(value: string): boolean {
  return value.length === 26 && [...value].every((c) => CROCKFORD.includes(c.toUpperCase()));
}

/** Stable device identity, e.g. POS-01, KDS-KITCHEN-01, WAITER-03. */
export type DeviceId = string;

export type DeviceType = "pos" | "kds" | "waiter" | "admin" | "server";

export type Device = {
  device_id: DeviceId;
  outlet_id: string;
  device_type: DeviceType;
  name: string;
  last_sync_at?: string;
  status: "active" | "retired";
  created_at: string;
  updated_at: string;
};

/** Outbox operation per entity write. */
export type OutboxOperation = "CREATE" | "UPDATE" | "DELETE";

/** Sync lifecycle of an outbox row — always visible, never silent. */
export type OutboxStatus = "pending" | "syncing" | "synced" | "failed" | "conflicted";

/**
 * Durable command envelope. One row per local mutation; the idempotency key
 * (command_id) lets safe retries re-send without double-applying.
 */
export type CommandEnvelope<TPayload = Record<string, unknown>> = {
  /** ULID — doubles as the idempotency key. */
  command_id: ULID;
  device_id: DeviceId;
  outlet_id: string;
  entity_type: string;
  entity_id: string;
  operation: OutboxOperation;
  payload: TPayload;
  /** Actor (Clerk user id or "staff"). */
  actor_id: string;
  /** Monotonic per-device sequence for causal ordering. */
  device_seq: number;
  created_at: string;
};

export type OutboxRow<TPayload = Record<string, unknown>> = CommandEnvelope<TPayload> & {
  status: OutboxStatus;
  synced_at?: string;
  retry_count: number;
  last_error?: string;
  /** Server's canonical verdict when this row conflicted. */
  conflict?: SyncConflict;
};

/** Structured server verdict for a conflicting command. */
export type SyncConflict = {
  reason: ConflictReason;
  server_version: number;
  server_updated_at: string;
  /** Minimal server state so the client can show both sides. */
  server_snapshot?: Record<string, unknown>;
  resolved_at?: string;
  resolution?: "server_wins" | "client_wins" | "merged" | "discarded";
};

export type ConflictReason =
  | "version_mismatch"
  | "already_terminal"
  | "duplicate_command"
  | "business_rule"
  | "stale_state";

/**
 * Conflict policy per entity family. Restaurant rule of thumb:
 * money and kitchen history are never last-write-wins.
 */
export type ConflictPolicy = "version_check" | "append_only" | "transactional" | "never_overwrite";

export const CONFLICT_POLICY: Record<string, ConflictPolicy> = {
  payment: "never_overwrite",
  refund: "never_overwrite",
  kot: "append_only",
  kot_line: "append_only",
  order: "version_check",
  order_item: "version_check",
  occupancy: "version_check",
  table: "version_check",
  floor: "version_check",
  customer: "version_check",
  inventory_txn: "transactional",
  stock: "transactional",
  event: "append_only",
};

/** Server push response per command. */
export type PushResult =
  | { command_id: ULID; ok: true; server_version: number }
  | { command_id: ULID; ok: false; conflict: SyncConflict; error?: string };

/** Pull response: canonical rows newer than the client's cursor. */
export type PullPage<T = Record<string, unknown>> = {
  entity_type: string;
  rows: T[];
  /** Opaque cursor the client stores for the next pull. */
  cursor: string;
  has_more: boolean;
};

/** Common record fields for every synced entity (arch doc §15). */
export type SyncedRecord = {
  id: string;
  outlet_id: string;
  device_id?: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
};

/** Inventory moves are transactions, never absolute quantity writes (§18). */
export type InventoryTxnType = "PURCHASE" | "SALE" | "WASTAGE" | "ADJUSTMENT" | "TRANSFER";

export type InventoryTxn = SyncedRecord & {
  raw_material_id: string;
  transaction_type: InventoryTxnType;
  quantity: number;
  reference_type?: string;
  reference_id?: string;
};

/**
 * Local SQLite DDL (mirror of @pixa/db Postgres schema, SQLite dialect).
 * Foundation subset: identity, outbox, events, sync cursor + core entities.
 * Money is integer paise; IDs are ULIDs; deletes are soft.
 */
export const LOCAL_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS kv_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    device_type TEXT NOT NULL,
    name TEXT NOT NULL,
    last_sync_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_outbox (
    command_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    device_seq INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    synced_at TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sync_outbox_status_idx ON sync_outbox (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    scope TEXT PRIMARY KEY,
    cursor TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    device_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT,
    actor_id TEXT,
    reason_text TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS events_entity_idx ON events (entity_type, entity_id)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    device_id TEXT,
    order_number TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'dine_in',
    table_id TEXT,
    occupancy_group_id TEXT,
    customer_id TEXT,
    status TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    tax_paise INTEGER NOT NULL DEFAULT 0,
    grand_total_paise INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS kots (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    device_id TEXT,
    order_id TEXT NOT NULL,
    kot_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    outlet_id TEXT NOT NULL,
    device_id TEXT,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    tendered_paise INTEGER,
    change_paise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
  )`,
];

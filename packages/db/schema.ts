/**
 * @pixa/db — central Postgres schema (Neon) + client.
 *
 * Canonical source of truth that devices sync toward. Money is integer paise
 * everywhere (ADR-0001). IDs are ULIDs (device-generated, offline-safe).
 * Deletes are soft (`deleted_at`) so other devices learn about them (§16).
 * Inventory moves through transactions, never absolute writes (§18).
 */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const audit = {
  outletId: text("outlet_id").notNull(),
  deviceId: text("device_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const devices = pgTable("devices", {
  deviceId: text("device_id").primaryKey(),
  outletId: text("outlet_id").notNull(),
  deviceType: text("device_type").notNull(),
  name: text("name").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const floors = pgTable("floors", {
  id: text("id").primaryKey(),
  ...audit,
  name: text("name").notNull(),
  code: text("code").notNull(),
  level: integer("level").default(0).notNull(),
  capacity: integer("capacity").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const tables = pgTable(
  "tables",
  {
    id: text("id").primaryKey(),
    ...audit,
    floorId: text("floor_id").notNull(),
    number: text("number").notNull(),
    code: text("code").notNull(),
    capacity: integer("capacity").notNull(),
    shape: text("shape").default("square").notNull(),
    type: text("type").default("standard").notNull(),
    allowsSharing: boolean("allows_sharing").default(false).notNull(),
    status: text("status").default("available").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    xMm: integer("x_mm").default(0).notNull(),
    yMm: integer("y_mm").default(0).notNull(),
    wMm: integer("w_mm").default(0).notNull(),
    hMm: integer("h_mm").default(0).notNull(),
    rotationDeg: integer("rotation_deg").default(0).notNull(),
    zIndex: integer("z_index").default(0).notNull(),
  },
  (t) => [index("tables_floor_idx").on(t.floorId)],
);

export const occupancyGroups = pgTable(
  "occupancy_groups",
  {
    id: text("id").primaryKey(),
    ...audit,
    tableId: text("table_id").notNull(),
    floorId: text("floor_id").notNull(),
    seats: integer("seats").notNull(),
    label: text("label"),
    colorIndex: integer("color_index").default(0).notNull(),
    orderId: text("order_id"),
    status: text("status").notNull(),
    seatedAt: timestamp("seated_at", { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: text("release_reason"),
    forceReleased: boolean("force_released").default(false).notNull(),
  },
  (t) => [index("occupancy_table_idx").on(t.tableId)],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderNumber: text("order_number").notNull(),
    channel: text("channel").default("dine_in").notNull(),
    tableId: text("table_id"),
    occupancyGroupId: text("occupancy_group_id"),
    customerId: text("customer_id"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    status: text("status").notNull(),
    paymentStatus: text("payment_status").default("UNPAID").notNull(),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).default(0).notNull(),
    discountPaise: bigint("discount_paise", { mode: "number" }).default(0).notNull(),
    taxPaise: bigint("tax_paise", { mode: "number" }).default(0).notNull(),
    grandTotalPaise: bigint("grand_total_paise", { mode: "number" }).default(0).notNull(),
  },
  (t) => [
    index("orders_table_idx").on(t.tableId),
    index("orders_outlet_status_idx").on(t.outletId, t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderId: text("order_id").notNull(),
    menuItemId: text("menu_item_id").notNull(),
    variantId: text("variant_id"),
    modifierIds: jsonb("modifier_ids").$type<string[]>().default([]).notNull(),
    qty: integer("qty").notNull(),
    unitPricePaise: bigint("unit_price_paise", { mode: "number" }).default(0).notNull(),
    lineTotalPaise: bigint("line_total_paise", { mode: "number" }).default(0).notNull(),
    lineTaxPaise: bigint("line_tax_paise", { mode: "number" }).default(0).notNull(),
    kotId: text("kot_id"),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    instructions: text("instructions"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const kots = pgTable(
  "kots",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderId: text("order_id").notNull(),
    kotNumber: integer("kot_number").notNull(),
    status: text("status").notNull(),
  },
  (t) => [index("kots_order_idx").on(t.orderId)],
);

export const kotLines = pgTable(
  "kot_lines",
  {
    id: text("id").primaryKey(),
    ...audit,
    kotId: text("kot_id").notNull(),
    orderLineId: text("order_line_id").notNull(),
    qty: integer("qty").notNull(),
    voidedQty: integer("voided_qty").default(0).notNull(),
    status: text("status").notNull(),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
  },
  (t) => [index("kot_lines_kot_idx").on(t.kotId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderId: text("order_id").notNull(),
    method: text("method").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    tenderedPaise: bigint("tendered_paise", { mode: "number" }),
    changePaise: bigint("change_paise", { mode: "number" }).default(0).notNull(),
    status: text("status").notNull(),
    partitionLabel: text("partition_label"),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderId: text("order_id").notNull(),
    paymentId: text("payment_id"),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull(),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  ...audit,
  name: text("name").notNull(),
  phone: text("phone").notNull(),
});

export const inventoryTxns = pgTable(
  "inventory_txns",
  {
    id: text("id").primaryKey(),
    ...audit,
    rawMaterialId: text("raw_material_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
  },
  (t) => [index("inventory_txns_material_idx").on(t.rawMaterialId)],
);

/** Append-only business events (audit trail feeds KDS/reports). */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id").notNull(),
    deviceId: text("device_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    actorId: text("actor_id"),
    reasonText: text("reason_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("events_entity_idx").on(t.entityType, t.entityId),
    index("events_outlet_time_idx").on(t.outletId, t.createdAt),
  ],
);

/**
 * Idempotency ledger: every applied command_id is recorded so retries and
 * re-sent batches can never double-apply (money safety).
 */
export const appliedCommands = pgTable(
  "applied_commands",
  {
    commandId: text("command_id").primaryKey(),
    deviceId: text("device_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    serverVersion: integer("server_version"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("applied_commands_id_uidx").on(t.commandId)],
);

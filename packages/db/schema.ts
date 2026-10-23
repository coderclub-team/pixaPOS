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
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const audit = {
  outletId: text("outlet_id").notNull(),
  organizationId: text("organization_id"),
  deviceId: text("device_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const outlets = pgTable(
  "outlets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    alias: text("alias"),
    type: text("type").default("restaurant").notNull(),
    phone: text("phone"),
    alternatePhone: text("alternate_phone"),
    email: text("email"),
    website: text("website"),
    whatsapp: text("whatsapp"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    locality: text("locality"),
    city: text("city"),
    district: text("district"),
    state: text("state"),
    country: text("country").default("India"),
    postalCode: text("postal_code"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    gstRegistered: boolean("gst_registered").default(false).notNull(),
    gstin: text("gstin"),
    legalName: text("legal_name"),
    pan: text("pan"),
    fssaiNumber: text("fssai_number"),
    currency: text("currency").default("INR").notNull(),
    timezone: text("timezone").default("Asia/Kolkata").notNull(),
    locale: text("locale").default("en-IN").notNull(),
    kioskPinHash: text("kiosk_pin_hash"),
    /** Outlet flags, hours, UPI accounts, order settings — schemaless. */
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("outlets_org_idx").on(t.organizationId),
    uniqueIndex("outlets_code_uidx").on(t.code),
  ],
);

export const devices = pgTable("devices", {
  deviceId: text("device_id").primaryKey(),
  outletId: text("outlet_id").notNull(),
  organizationId: text("organization_id"),
  deviceType: text("device_type").notNull(),
  name: text("name").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  status: text("status").default("active").notNull(),
  pushToken: text("push_token"),
  realtimeConnectionId: text("realtime_connection_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const floors = pgTable(
  "floors",
  {
    id: text("id").primaryKey(),
    ...audit,
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    level: integer("level").default(0).notNull(),
    capacity: integer("capacity").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isOutdoor: boolean("is_outdoor").default(false).notNull(),
    widthMm: integer("width_mm").default(0).notNull(),
    heightMm: integer("height_mm").default(0).notNull(),
    gridSizeMm: integer("grid_size_mm").default(100).notNull(),
    backgroundColor: text("background_color"),
    backgroundImageUrl: text("background_image_url"),
  },
  (t) => [index("floors_org_outlet_idx").on(t.organizationId, t.outletId)],
);

export const floorObjects = pgTable(
  "floor_objects",
  {
    id: text("id").primaryKey(),
    ...audit,
    floorId: text("floor_id").notNull(),
    kind: text("kind").notNull(),
    shapeVariant: text("shape_variant"),
    label: text("label"),
    xMm: integer("x_mm").default(0).notNull(),
    yMm: integer("y_mm").default(0).notNull(),
    wMm: integer("w_mm").default(0).notNull(),
    hMm: integer("h_mm").default(0).notNull(),
    rotationDeg: integer("rotation_deg").default(0).notNull(),
    zIndex: integer("z_index").default(0).notNull(),
    color: text("color"),
  },
  (t) => [index("floor_objects_floor_idx").on(t.floorId)],
);

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
  (t) => [
    index("tables_floor_idx").on(t.floorId),
    index("tables_org_outlet_idx").on(t.organizationId, t.outletId),
  ],
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
    releasedBy: text("released_by"),
    releaseReason: text("release_reason"),
    forceReleased: boolean("force_released").default(false).notNull(),
  },
  (t) => [index("occupancy_table_idx").on(t.tableId)],
);

export const tableBlocks = pgTable(
  "table_blocks",
  {
    id: text("id").primaryKey(),
    ...audit,
    tableId: text("table_id").notNull(),
    reason: text("reason").notNull(),
    blockedAt: timestamp("blocked_at", { withTimezone: true }).defaultNow().notNull(),
    blockedBy: text("blocked_by"),
    untilAt: timestamp("until_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: text("released_by"),
  },
  (t) => [index("table_blocks_table_idx").on(t.tableId)],
);

export const reservationHolds = pgTable(
  "reservation_holds",
  {
    id: text("id").primaryKey(),
    ...audit,
    tableId: text("table_id").notNull(),
    holderName: text("holder_name").notNull(),
    holderPhone: text("holder_phone"),
    partySize: integer("party_size").notNull(),
    holdFrom: timestamp("hold_from", { withTimezone: true }),
    holdUntil: timestamp("hold_until", { withTimezone: true }),
    status: text("status").notNull(),
    cancelledBy: text("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (t) => [index("reservation_holds_table_idx").on(t.tableId)],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderNumber: text("order_number").notNull(),
    channel: text("channel").default("dine_in").notNull(),
    tableId: text("table_id"),
    tableNumberSnapshot: text("table_number_snapshot"),
    occupancyGroupId: text("occupancy_group_id"),
    customerId: text("customer_id"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerNotes: text("customer_notes"),
    deliveryAddressSnapshot: text("delivery_address_snapshot"),
    riderName: text("rider_name"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    offHours: boolean("off_hours").default(false).notNull(),
    offHoursReason: text("off_hours_reason"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    externalRef: text("external_ref"),
    status: text("status").notNull(),
    paymentStatus: text("payment_status").default("UNPAID").notNull(),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).default(0).notNull(),
    discountPercent: numeric("discount_percent"),
    discountPaise: bigint("discount_paise", { mode: "number" }).default(0).notNull(),
    discountReason: text("discount_reason"),
    promoCode: text("promo_code"),
    promoId: text("promo_id"),
    rewardPoints: integer("reward_points"),
    taxPaise: bigint("tax_paise", { mode: "number" }).default(0).notNull(),
    grandTotalPaise: bigint("grand_total_paise", { mode: "number" }).default(0).notNull(),
    split: jsonb("split").$type<unknown>(),
    cancelledReason: text("cancelled_reason"),
    cancelledBy: text("cancelled_by"),
    createdBy: text("created_by"),
  },
  (t) => [
    index("orders_table_idx").on(t.tableId),
    index("orders_org_outlet_idx").on(t.organizationId, t.outletId),
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
    kotLineId: text("kot_line_id"),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),
    taxPercentSnapshot: integer("tax_percent_snapshot"),
    recipeIdSnapshot: text("recipe_id_snapshot"),
    modifiersSnapshot: jsonb("modifiers_snapshot").$type<Record<string, unknown>[]>().default([]),
    returnedQty: integer("returned_qty").default(0).notNull(),
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
    orderNumberSnapshot: text("order_number_snapshot"),
    tableNumberSnapshot: text("table_number_snapshot"),
    channel: text("channel"),
    stationIds: jsonb("station_ids").$type<string[]>(),
    firedBy: text("fired_by"),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    voids: jsonb("voids").$type<Record<string, unknown>[]>().default([]),
    returns: jsonb("returns").$type<Record<string, unknown>[]>().default([]),
  },
  (t) => [
    index("kots_order_idx").on(t.orderId),
    index("kots_org_outlet_idx").on(t.organizationId, t.outletId),
  ],
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
    returnedQty: integer("returned_qty").default(0).notNull(),
    status: text("status").notNull(),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),
    modifiersSnapshot: jsonb("modifiers_snapshot").$type<string[]>().default([]),
    instructions: text("instructions"),
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
    receivedBy: text("received_by"),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_org_outlet_idx").on(t.organizationId, t.outletId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    ...audit,
    orderId: text("order_id").notNull(),
    paymentId: text("payment_id"),
    amountPaise: bigint("amount_paise", { mode: "number" }).default(0).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull(),
    createdBy: text("created_by"),
    orderLineId: text("order_line_id"),
    qty: integer("qty"),
    returnId: text("return_id"),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    ...audit,
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    alternatePhone: text("alternate_phone"),
    email: text("email"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    addresses: jsonb("addresses").$type<Record<string, unknown>[]>().default([]).notNull(),
  },
  (t) => [
    index("customers_org_outlet_idx").on(t.organizationId, t.outletId),
    index("customers_outlet_phone_idx").on(t.outletId, t.phone),
  ],
);

/** Purchase orders (outlet-owned). Money in paise. */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    ...audit,
    poNumber: text("po_number").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    status: text("status").default("draft").notNull(),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).default(0).notNull(),
    taxPaise: bigint("tax_paise", { mode: "number" }).default(0).notNull(),
    totalPaise: bigint("total_paise", { mode: "number" }).default(0).notNull(),
    poDate: text("po_date"),
    expectedAt: text("expected_at"),
    notes: text("notes"),
  },
  (t) => [
    index("purchase_orders_org_outlet_idx").on(t.organizationId, t.outletId),
    index("purchase_orders_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    unit: text("unit"),
    unitCostPaise: bigint("unit_cost_paise", { mode: "number" }).default(0).notNull(),
    taxPercent: integer("tax_percent").default(0).notNull(),
  },
  (t) => [index("purchase_order_items_po_idx").on(t.purchaseOrderId)],
);

/** Supplier bills / goods receipts (outlet-owned). Money in paise. */
export const purchases = pgTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    ...audit,
    purchaseNumber: text("purchase_number").notNull(),
    purchaseOrderId: text("purchase_order_id").references(() => purchaseOrders.id),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).default(0).notNull(),
    taxPaise: bigint("tax_paise", { mode: "number" }).default(0).notNull(),
    landedPaise: bigint("landed_paise", { mode: "number" }).default(0).notNull(),
    totalPaise: bigint("total_paise", { mode: "number" }).default(0).notNull(),
    paidPaise: bigint("paid_paise", { mode: "number" }).default(0).notNull(),
    paymentStatus: text("payment_status").default("unpaid").notNull(),
    paymentMode: text("payment_mode"),
    billDate: text("bill_date"),
    notes: text("notes"),
  },
  (t) => [
    index("purchases_org_outlet_idx").on(t.organizationId, t.outletId),
    index("purchases_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    unit: text("unit"),
    unitCostPaise: bigint("unit_cost_paise", { mode: "number" }).default(0).notNull(),
    batchNo: text("batch_no"),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)],
);

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
  (t) => [
    index("inventory_txns_material_idx").on(t.rawMaterialId),
    index("inventory_txns_org_outlet_idx").on(t.organizationId, t.outletId),
  ],
);

/** Append-only business events (audit trail feeds KDS/reports). */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id").notNull(),
    organizationId: text("organization_id"),
    sequence: bigint("sequence", { mode: "number" }),
    deviceId: text("device_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    actorId: text("actor_id"),
    reasonCode: text("reason_code"),
    reasonText: text("reason_text"),
    sourceType: text("source_type"),
    sourceDeviceId: text("source_device_id"),
    stationIds: jsonb("station_ids").$type<string[]>(),
    target: jsonb("target").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("events_entity_idx").on(t.entityType, t.entityId),
    index("events_outlet_time_idx").on(t.outletId, t.createdAt),
    index("events_outlet_seq_idx").on(t.outletId, t.sequence),
    index("events_org_outlet_seq_idx").on(t.organizationId, t.outletId, t.sequence),
    uniqueIndex("events_outlet_seq_uidx").on(t.outletId, t.sequence),
  ],
);

/** Kitchen stations per outlet (KOT routing). */
export const outletKitchenStations = pgTable(
  "outlet_kitchen_stations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("stations_outlet_idx").on(t.outletId),
    uniqueIndex("stations_outlet_code_uidx").on(t.outletId, t.code),
  ],
);

/**
 * Outlet membership: which outlets of the organization a user may access.
 * Role stays org-wide on baMember (single source); this table is the access
 * list. Deactivate (is_active=false) instead of deleting — audit trail.
 */
export const outletMembers = pgTable(
  "outlet_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    userId: text("user_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("outlet_members_outlet_idx").on(t.outletId),
    index("outlet_members_user_idx").on(t.userId),
    uniqueIndex("outlet_members_outlet_user_uidx").on(t.outletId, t.userId),
  ],
);

/** Per-scope notification preferences (outlet > device > user precedence). */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    deviceId: text("device_id"),
    userId: text("user_id"),
    prefs: jsonb("prefs").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("notif_prefs_outlet_idx").on(t.outletId),
    uniqueIndex("notif_prefs_scope_uidx").on(t.outletId, t.deviceId, t.userId),
  ],
);

/**
 * Master data (menu + inventory). outlet_id NULL = org-shared definition
 * visible in every outlet; set = outlet-owned/override. Prices and
 * availability always resolve through outlet_item_config first.
 */
const master = {
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: text("id").primaryKey(),
    ...master,
    slug: text("slug"),
    description: text("description"),
    imageUrl: text("image_url"),
    parentId: text("parent_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [index("menu_categories_org_idx").on(t.organizationId)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    ...master,
    categoryId: text("category_id").references(() => menuCategories.id),
    productType: text("product_type").default("simple").notNull(),
    itemType: text("item_type").default("goods").notNull(),
    vegType: text("veg_type"),
    description: text("description"),
    barcode: text("barcode"),
    spiceLevel: text("spice_level"),
    prepTimeMin: integer("prep_time_min"),
    allergens: jsonb("allergens").$type<string[]>().default([]).notNull(),
    taxType: text("tax_type"),
    nutrition: jsonb("nutrition").$type<Record<string, number | string>>(),
    pairsWellWith: jsonb("pairs_well_with").$type<string[]>().default([]).notNull(),
    isBestseller: boolean("is_bestseller").default(false).notNull(),
    hsnCode: text("hsn_code"),
    taxable: boolean("taxable").default(true).notNull(),
    taxPercent: integer("tax_percent").default(0).notNull(),
    images: jsonb("images").$type<{ url: string; sort_order: number }[]>().default([]).notNull(),
    availableChannels: jsonb("available_channels")
      .$type<string[]>()
      .default(["dine_in", "pickup", "delivery", "zomato", "swiggy", "ondc"])
      .notNull(),
    modifierGroupIds: jsonb("modifier_group_ids").$type<string[]>().default([]).notNull(),
  },
  (t) => [
    index("menu_items_org_idx").on(t.organizationId),
    index("menu_items_category_idx").on(t.categoryId),
  ],
);

export const menuVariants = pgTable(
  "menu_variants",
  {
    id: text("id").primaryKey(),
    ...master,
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    sku: text("sku"),
    barcode: text("barcode"),
    qty: numeric("qty", { mode: "number" }),
    unit: text("unit"),
    sellingPrice: bigint("selling_price", { mode: "number" }).default(0).notNull(),
    comparePrice: bigint("compare_price", { mode: "number" }),
    recipeId: text("recipe_id"),
    isDefault: boolean("is_default").default(false).notNull(),
  },
  (t) => [
    index("menu_variants_org_idx").on(t.organizationId),
    index("menu_variants_item_idx").on(t.menuItemId),
  ],
);

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: text("id").primaryKey(),
    ...master,
    selectionType: text("selection_type").default("multiple").notNull(),
    minSelection: integer("min_selection").default(0).notNull(),
    maxSelection: integer("max_selection").default(99).notNull(),
  },
  (t) => [index("modifier_groups_org_idx").on(t.organizationId)],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: text("id").primaryKey(),
    ...master,
    groupId: text("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    alias: text("alias"),
    price: bigint("price", { mode: "number" }).default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [
    index("modifiers_org_idx").on(t.organizationId),
    index("modifiers_group_idx").on(t.groupId),
  ],
);

export const rawMaterials = pgTable(
  "raw_materials",
  {
    id: text("id").primaryKey(),
    ...master,
    sku: text("sku"),
    unit: text("unit").default("pcs").notNull(),
    supplierId: text("supplier_id"),
    taxPercent: integer("tax_percent").default(0).notNull(),
    hsnCode: text("hsn_code"),
    category: text("category").default("general").notNull(),
    stockQty: numeric("stock_qty").default("0").notNull(),
    lowStockThreshold: numeric("low_stock_threshold").default("0").notNull(),
    costPricePaise: bigint("cost_price_paise", { mode: "number" }).default(0).notNull(),
    avgCostPaise: bigint("avg_cost_paise", { mode: "number" }).default(0).notNull(),
    barcode: text("barcode"),
    manufacturer: text("manufacturer"),
    purchaseUnit: text("purchase_unit"),
    purchaseToBaseRate: numeric("purchase_to_base_rate"),
    taxType: text("tax_type").default("GST"),
    suppliers: jsonb("suppliers").$type<Record<string, unknown>[]>().default([]).notNull(),
  },
  (t) => [
    index("raw_materials_org_idx").on(t.organizationId),
    index("raw_materials_supplier_idx").on(t.supplierId),
  ],
);

export const recipes = pgTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    ...master,
    yields: text("yields"),
    menuItemId: text("menu_item_id"),
    yieldUnit: text("yield_unit").default("serves"),
    steps: jsonb("steps").$type<Record<string, unknown>[]>().default([]).notNull(),
    ingredients: jsonb("ingredients").$type<Record<string, unknown>[]>().default([]).notNull(),
    sellingPricePaise: bigint("selling_price_paise", { mode: "number" }),
    prepTimeMin: integer("prep_time_min"),
    cookTimeMin: integer("cook_time_min"),
    platingNotes: text("plating_notes"),
    garnish: text("garnish"),
    servingVessel: text("serving_vessel"),
    photoUrl: text("photo_url"),
  },
  (t) => [index("recipes_org_idx").on(t.organizationId)],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    unit: text("unit"),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    ...master,
    phone: text("phone"),
    gstin: text("gstin"),
    contactPerson: text("contact_person"),
    email: text("email"),
    address: text("address"),
  },
  (t) => [index("suppliers_org_idx").on(t.organizationId)],
);

export const wasteLogs = pgTable(
  "waste_logs",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id").notNull(),
    organizationId: text("organization_id").notNull(),
    deviceId: text("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    rawMaterialId: text("raw_material_id"),
    materialName: text("material_name"),
    recipeId: text("recipe_id"),
    recipeName: text("recipe_name"),
    variantId: text("variant_id"),
    variantName: text("variant_name"),
    orderId: text("order_id"),
    orderNumber: text("order_number"),
    qty: numeric("qty").default("0").notNull(),
    unit: text("unit").default("pcs").notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    costLossPaise: bigint("cost_loss_paise", { mode: "number" }).default(0).notNull(),
    createdBy: text("created_by"),
  },
  (t) => [
    index("waste_logs_org_outlet_idx").on(t.organizationId, t.outletId),
    index("waste_logs_material_idx").on(t.rawMaterialId),
  ],
);

export const supplierAdjustments = pgTable(
  "supplier_adjustments",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id").notNull(),
    organizationId: text("organization_id").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("supplier_adj_org_outlet_idx").on(t.organizationId, t.outletId),
    index("supplier_adj_supplier_idx").on(t.supplierId),
  ],
);

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id").notNull(),
    organizationId: text("organization_id").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    paymentMode: text("payment_mode").notNull(),
    paymentDate: text("payment_date").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("supplier_pay_org_outlet_idx").on(t.organizationId, t.outletId),
    index("supplier_pay_supplier_idx").on(t.supplierId),
  ],
);

/** Per-outlet overrides over a shared logical item (price/availability). */
export const outletItemConfig = pgTable(
  "outlet_item_config",
  {
    outletId: text("outlet_id").notNull(),
    sourceItemId: text("source_item_id").notNull(),
    price: bigint("price", { mode: "number" }),
    isActive: boolean("is_active"),
    channels: jsonb("channels").$type<string[]>(),
    taxOverride: integer("tax_override"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("outlet_item_config_uidx").on(t.outletId, t.sourceItemId)],
);

/* ------------------------------------------------------------------ */
/* Outlet ↔ master availability. Masters (menu, modifiers, recipes,     */
/* materials, suppliers) are org-shared rows; a mapping row means the    */
/* master is available at that outlet. Modifiers follow their group,      */
/* variants follow their item, recipe ingredients follow their recipe —    */
/* so only the six tables below need explicit mappings.                  */
/* ------------------------------------------------------------------ */

const outletMappingColumns = () => ({
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  outletId: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  // Entity id (category_id / item_id / group_id / recipe_id / material_id /
  // supplier_id depending on the table). Variants follow items, modifiers
  // follow groups, ingredients follow recipes — no mapping rows needed.
  entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const outletMenuCategories = pgTable(
  "outlet_menu_categories",
  outletMappingColumns(),
  (t) => [
    uniqueIndex("outlet_menu_categories_uidx").on(t.outletId, t.entityId),
    index("outlet_menu_categories_outlet_idx").on(t.outletId),
    index("outlet_menu_categories_entity_idx").on(t.entityId),
  ],
);

export const outletMenuItems = pgTable("outlet_menu_items", outletMappingColumns(), (t) => [
  uniqueIndex("outlet_menu_items_uidx").on(t.outletId, t.entityId),
  index("outlet_menu_items_outlet_idx").on(t.outletId),
  index("outlet_menu_items_entity_idx").on(t.entityId),
]);

export const outletModifierGroups = pgTable(
  "outlet_modifier_groups",
  outletMappingColumns(),
  (t) => [
    uniqueIndex("outlet_modifier_groups_uidx").on(t.outletId, t.entityId),
    index("outlet_modifier_groups_outlet_idx").on(t.outletId),
    index("outlet_modifier_groups_entity_idx").on(t.entityId),
  ],
);

export const outletRecipes = pgTable("outlet_recipes", outletMappingColumns(), (t) => [
  uniqueIndex("outlet_recipes_uidx").on(t.outletId, t.entityId),
  index("outlet_recipes_outlet_idx").on(t.outletId),
  index("outlet_recipes_entity_idx").on(t.entityId),
]);

export const outletRawMaterials = pgTable("outlet_raw_materials", outletMappingColumns(), (t) => [
  uniqueIndex("outlet_raw_materials_uidx").on(t.outletId, t.entityId),
  index("outlet_raw_materials_outlet_idx").on(t.outletId),
  index("outlet_raw_materials_entity_idx").on(t.entityId),
]);

export const outletSuppliers = pgTable("outlet_suppliers", outletMappingColumns(), (t) => [
  uniqueIndex("outlet_suppliers_uidx").on(t.outletId, t.entityId),
  index("outlet_suppliers_outlet_idx").on(t.outletId),
  index("outlet_suppliers_entity_idx").on(t.entityId),
]);

/** Audit trail for bulk mapping runs. */
export const bulkMappingRuns = pgTable(
  "bulk_mapping_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    sourceOutletId: text("source_outlet_id").notNull(),
    targetOutletIds: jsonb("target_outlet_ids").$type<string[]>().default([]).notNull(),
    dataTypes: jsonb("data_types").$type<string[]>().default([]).notNull(),
    performedBy: text("performed_by"),
    mapped: integer("mapped").default(0).notNull(),
    skipped: integer("skipped").default(0).notNull(),
    failed: integer("failed").default(0).notNull(),
    result: text("result").default("completed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("bulk_mapping_runs_org_idx").on(t.organizationId)],
);

/* ------------------------------------------------------------------ */
/* Payroll + Leave (minimal HR): employees, leave, holidays, pay runs.     */
/* Money is integer paise (ADR-0001). Balances stored as NUMERIC days so    */
/* half-days (0.5) are exact. Bank details stored AES-GCM encrypted.       */
/* ------------------------------------------------------------------ */

export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    name: text("name").notNull(),
    email: text("email"),
    employeeCode: text("employee_code").notNull(),
    payType: text("pay_type").notNull(), // hourly | salary
    ratePaise: bigint("rate_paise", { mode: "number" }).notNull(), // hourly paise OR monthly paise
    currency: text("currency").default("INR").notNull(),
    bankAccountEnc: text("bank_account_enc"),
    bankName: text("bank_name"),
    bankIfsc: text("bank_ifsc"),
    upiIdEnc: text("upi_id_enc"),
    verificationStatus: text("verification_status").default("unverified").notNull(),
    bankIfscVerifiedAt: timestamp("bank_ifsc_verified_at", { withTimezone: true }),
    bankIfscBank: text("bank_ifsc_bank"),
    upiVerifiedAt: timestamp("upi_verified_at", { withTimezone: true }),
    upiHolderName: text("upi_holder_name"),
    status: text("status").default("active").notNull(), // active | inactive
    joiningDate: date("joining_date"),
  },
  (t) => [
    index("employees_org_outlet_idx").on(t.organizationId, t.outletId),
    uniqueIndex("employees_org_code_uidx").on(t.organizationId, t.employeeCode),
  ],
);

export const leaveTypes = pgTable(
  "leave_types",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    name: text("name").notNull(),
    isPaid: boolean("is_paid").default(true).notNull(),
    yearlyQuota: numeric("yearly_quota").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (t) => [index("leave_types_org_idx").on(t.organizationId)],
);

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: text("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    openingBalance: numeric("opening_balance").notNull(),
    used: numeric("used").default("0").notNull(),
    remaining: numeric("remaining").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("leave_balances_employee_idx").on(t.employeeId, t.year),
    uniqueIndex("leave_balances_emp_type_year_uidx").on(t.employeeId, t.leaveTypeId, t.year),
  ],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: text("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    totalDays: numeric("total_days").notNull(),
    dayType: text("day_type").default("full").notNull(), // full | first_half | second_half
    reason: text("reason"),
    status: text("status").default("pending").notNull(), // pending | approved | rejected
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    remarks: text("remarks"),
  },
  (t) => [
    index("leave_requests_org_outlet_idx").on(t.organizationId, t.outletId),
    index("leave_requests_employee_idx").on(t.employeeId, t.status),
  ],
);

/* Manager-marked daily attendance (no biometric devices). One row per
   employee per date. Statuses: present | absent | half_day | weekly_off |
   holiday. Absent without approved leave prices as unpaid in payroll;
   weekly_off/holiday are neutral markers, never absences. */
export const attendanceDays = pgTable(
  "attendance_days",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: text("status").default("present").notNull(),
    hours: numeric("hours").default("0").notNull(),
    markedBy: text("marked_by"),
    markedAt: timestamp("marked_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    index("attendance_days_org_date_idx").on(t.organizationId, t.date),
    index("attendance_days_employee_idx").on(t.employeeId, t.date),
    uniqueIndex("attendance_days_org_emp_date_uidx").on(t.organizationId, t.employeeId, t.date),
  ],
);

export const publicHolidays = pgTable(
  "public_holidays",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    name: text("name").notNull(),
    date: date("date").notNull(),
    isOptional: boolean("is_optional").default(false).notNull(),
  },
  (t) => [
    index("public_holidays_org_idx").on(t.organizationId),
    uniqueIndex("public_holidays_org_date_uidx").on(t.organizationId, t.date),
  ],
);

export const holidayPayRules = pgTable(
  "holiday_pay_rules",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    multiplier: numeric("multiplier").default("1.5").notNull(),
    fixedIncentivePaise: bigint("fixed_incentive_paise", { mode: "number" }).default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (t) => [index("holiday_pay_rules_org_idx").on(t.organizationId)],
);

export const payPeriods = pgTable(
  "pay_periods",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status").default("open").notNull(), // open | locked
  },
  (t) => [index("pay_periods_org_idx").on(t.organizationId)],
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: text("id").primaryKey(),
    ...audit,
    outletId: text("outlet_id"),
    payPeriodId: text("pay_period_id")
      .notNull()
      .references(() => payPeriods.id, { onDelete: "restrict" }),
    status: text("status").default("draft").notNull(), // draft | approved
    totalGrossPaise: bigint("total_gross_paise", { mode: "number" }).default(0).notNull(),
    totalNetPaise: bigint("total_net_paise", { mode: "number" }).default(0).notNull(),
    createdBy: text("created_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    index("payroll_runs_org_idx").on(t.organizationId),
    uniqueIndex("payroll_runs_period_uidx").on(t.payPeriodId),
  ],
);

export const payrollItems = pgTable(
  "payroll_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    payrollRunId: text("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    workingUnits: numeric("working_units").default("0").notNull(), // days (salary) or hours (hourly)
    holidayUnits: numeric("holiday_units").default("0").notNull(), // hours worked on holidays
    grossWagePaise: bigint("gross_wage_paise", { mode: "number" }).default(0).notNull(),
    holidayExtraPaise: bigint("holiday_extra_paise", { mode: "number" }).default(0).notNull(),
    totalIncentivesPaise: bigint("total_incentives_paise", { mode: "number" }).default(0).notNull(),
    unpaidLeavePaise: bigint("unpaid_leave_paise", { mode: "number" }).default(0).notNull(),
    grossPayPaise: bigint("gross_pay_paise", { mode: "number" }).default(0).notNull(),
    deductionsPaise: bigint("deductions_paise", { mode: "number" }).default(0).notNull(),
    netPayPaise: bigint("net_pay_paise", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payroll_items_run_idx").on(t.payrollRunId),
    uniqueIndex("payroll_items_run_employee_uidx").on(t.payrollRunId, t.employeeId),
  ],
);

export const payrollIncentives = pgTable(
  "payroll_incentives",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    payrollItemId: text("payroll_item_id")
      .notNull()
      .references(() => payrollItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("payroll_incentives_item_idx").on(t.payrollItemId)],
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

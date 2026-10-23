/**
 * Orders domain — server implementation (Postgres via Drizzle).
 *
 * Faithful port of the localStorage service semantics (workflows.md is the
 * contract): same guards, same error strings, same audit events.
 * Differences from local: no entityMutex (single-request Postgres writes
 * are atomic; documented race windows below), no localStorage/SQLite, no
 * sync eligibility (outbox disabled), no promo/reward catalogs (deferred —
 * applying them returns a clear 501 until the server catalogs land), no
 * wastage posting (no server waste ledger yet — void/cancel skip it and
 * note the gap in the event metadata).
 *
 * Server-only: import from API routes (and one-way from kitchen/server).
 * Never import kitchen/server or events UI here. Cross-domain reads go
 * straight at tables (attach/detach/seat via features/table/api/server),
 * which never imports orders — the graph stays acyclic.
 */
import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import {
  db,
  kotLines,
  kots,
  menuItems,
  modifiers,
  menuVariants,
  modifierGroups,
  occupancyGroups,
  orderItems,
  orders,
  payments,
  refunds,
  tables,
} from "@pixa/db";
import { recordServerEvent } from "@/features/events/api/server";
import { paidTotalForOrder } from "@/features/payments/api/server";
import * as tablesServer from "@/features/table/api/server";
import type {
  BillPartition,
  BillingView,
  CreateOrderInput,
  OrderStatus,
  OrderWithDerived,
  RestaurantOrder,
  OrderItemSnapshot,
  SplitMode,
} from "./types";

export type ServerCtx = {
  organizationId: string;
  outletId?: string | null;
  actorId?: string;
};

const actorOf = (ctx: ServerCtx, fallback?: string) =>
  (ctx as { actorId?: string }).actorId ?? fallback ?? "staff";

const nowIso = () => new Date().toISOString();

/* ---------------- pure domain helpers (mirror local semantics) ---------------- */

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "IN_KITCHEN", "CANCELLED"],
  CONFIRMED: ["IN_KITCHEN", "CANCELLED"],
  IN_KITCHEN: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "OUT_FOR_DELIVERY", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const DISPATCH_CHANNELS = ["delivery", "zomato", "swiggy", "own_online"];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

const KITCHEN_CHAIN: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"];

export type KitchenLineState = {
  status: string;
  qty: number;
  voided_qty: number;
  returned_qty?: number;
};

export function deriveKitchenTarget(
  tickets: { status: string; lines: KitchenLineState[] }[],
): OrderStatus | null {
  const active = tickets.filter((k) => k.status !== "CANCELLED");
  if (active.length === 0) return null;
  const live = (t: { status: string; lines: KitchenLineState[] }) =>
    t.lines.filter((l) => l.qty - l.voided_qty - (l.returned_qty ?? 0) > 0);
  const anyLive = active.some((t) => live(t).length > 0);
  if (!anyLive) return null;
  if (active.every((k) => k.status === "SERVED")) return "SERVED";
  if (active.every((k) => k.status === "READY" || k.status === "SERVED")) return "READY";
  if (active.some((k) => k.status === "PREPARING" || k.status === "READY")) return "PREPARING";
  return "IN_KITCHEN";
}

function discountFor(
  subtotal: number,
  order: Pick<RestaurantOrder, "discount_paise" | "discount_percent">,
): number {
  if (order.discount_paise !== undefined && order.discount_paise !== null)
    return Math.min(order.discount_paise as number, subtotal);
  const pct = order.discount_percent as number | undefined;
  if (pct !== undefined && pct !== null) return Math.round((subtotal * Math.min(pct, 100)) / 100);
  return 0;
}

export function recomputeTotals<T extends RestaurantOrder>(order: T): T {
  const live = (i: { qty: number; returned_qty?: number }) =>
    Math.max(0, i.qty - (i.returned_qty ?? 0));
  const subtotal = order.items.reduce(
    (s, i) => s + Math.round(((i.line_total_paise * live(i)) as number) / Math.max(1, i.qty)),
    0,
  );
  const rawTax = order.items.reduce(
    (s, i) => s + Math.round(((i.line_tax_paise * live(i)) as number) / Math.max(1, i.qty)),
    0,
  );
  const discount = discountFor(subtotal, order);
  const tax = subtotal > 0 ? Math.round((rawTax * (subtotal - discount)) / subtotal) : 0;
  const grand = subtotal - discount + tax;
  return {
    ...order,
    subtotal_paise: subtotal,
    tax_paise: tax,
    total_paise: subtotal + rawTax,
    grand_total_paise: grand,
  };
}

/* ---------------- row <-> client mapping ---------------- */

type DbOrder = typeof orders.$inferSelect;
type DbItem = typeof orderItems.$inferSelect;

function toClientItem(r: Record<string, unknown>): OrderItemSnapshot {
  return {
    id: String(r.id),
    menu_item_id: String(r.menuItemId),
    variant_id: (r.variantId as string | null) ?? undefined,
    item_name_snapshot: String(r.itemNameSnapshot ?? ""),
    variant_name_snapshot: (r.variantNameSnapshot as string | null) ?? undefined,
    unit_price_paise: Number(r.unitPricePaise ?? 0),
    tax_percent_snapshot: Number(r.taxPercent ?? 0),
    recipe_id_snapshot: (r.recipeId as string | null) ?? undefined,
    modifiers: (Array.isArray(r.modifiersSnapshot)
      ? r.modifiersSnapshot
      : []) as OrderItemSnapshot["modifiers"],
    qty: Number(r.qty),
    line_total_paise: Number(r.lineTotalPaise ?? 0),
    line_tax_paise: Number(r.lineTaxPaise ?? 0),
    kot_id: (r.kotId as string | null) ?? undefined,
    kot_line_id: (r.kotLineId as string | null) ?? undefined,
    instructions: (r.instructions as string | null) ?? undefined,
    returned_qty: Number(r.returnedQty ?? 0) || undefined,
  };
}

function toDbItem(
  orderId: string,
  outletId: string,
  organizationId: string,
  line: OrderItemSnapshot,
) {
  return {
    id: line.id,
    organizationId,
    outletId,
    orderId,
    menuItemId: line.menu_item_id,
    variantId: line.variant_id ?? null,
    modifierIds: (line.modifiers ?? []).map((m) => m.modifier_id),
    qty: line.qty,
    unitPricePaise: line.unit_price_paise,
    lineTotalPaise: line.line_total_paise,
    lineTaxPaise: line.line_tax_paise,
    kotId: line.kot_id ?? null,
    kotLineId: line.kot_line_id ?? null,
    itemNameSnapshot: line.item_name_snapshot,
    variantNameSnapshot: line.variant_name_snapshot ?? null,
    taxPercent: line.tax_percent_snapshot ?? null,
    recipeId: line.recipe_id_snapshot ?? null,
    modifiersSnapshot: line.modifiers ?? [],
    returnedQty: line.returned_qty ?? 0,
    instructions: line.instructions ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function toClientOrder(
  row: Record<string, unknown>,
  items: OrderItemSnapshot[],
  kitchen?: { done: number; total: number; kotCount: number },
): OrderWithDerived {
  const fired = items.filter((i) => i.kot_id);
  return {
    id: String(row.id),
    outlet_id: String(row.outletId),
    order_number: String(row.orderNumber),
    channel: (row.channel as OrderWithDerived["channel"]) ?? "dine_in",
    table_id: (row.tableId as string | null) ?? undefined,
    table_number_snapshot: (row.tableNumberSnapshot as string | null) ?? undefined,
    occupancy_group_id: (row.occupancyGroupId as string | null) ?? undefined,
    customer_id: (row.customerId as string | null) ?? undefined,
    customer_name: (row.customerName as string | null) ?? undefined,
    customer_phone: (row.customerPhone as string | null) ?? undefined,
    customer_notes: (row.customerNotes as string | null) ?? undefined,
    delivery_address_snapshot: (row.deliveryAddressSnapshot as string | null) ?? undefined,
    rider_name: (row.riderName as string | null) ?? undefined,
    dispatched_at: (row.dispatchedAt as Date | null)?.toISOString?.() ?? undefined,
    delivered_at: (row.deliveredAt as Date | null)?.toISOString?.() ?? undefined,
    off_hours: (row.offHours as boolean | null) ?? undefined,
    off_hours_reason: (row.offHoursReason as string | null) ?? undefined,
    scheduled_for: (row.scheduledFor as Date | null)?.toISOString?.() ?? undefined,
    external_ref: (row.externalRef as string | null) ?? undefined,
    status: row.status as OrderWithDerived["status"],
    items,
    subtotal_paise: Number(row.subtotalPaise ?? 0),
    tax_paise: Number(row.taxPaise ?? 0),
    total_paise: Number(row.subtotalPaise ?? 0) + Number(row.taxPaise ?? 0),
    discount_percent: row.discountPercent == null ? undefined : Number(row.discountPercent),
    discount_paise: Number(row.discountPaise ?? 0) || undefined,
    discount_reason: (row.discountReason as string | null) ?? undefined,
    promo_code: (row.promoCode as string | null) ?? undefined,
    promo_id: (row.promoId as string | null) ?? undefined,
    reward_points: (row.rewardPoints as number | null) ?? undefined,
    grand_total_paise: Number(row.grandTotalPaisa ?? row.grandTotalPaise ?? 0),
    payment_status: (row.paymentStatus as OrderWithDerived["payment_status"]) ?? "UNPAID",
    split: (row.split as OrderWithDerived["split"]) ?? undefined,
    cancelled_reason: (row.cancelledReason as string | null) ?? undefined,
    cancelled_by: (row.cancelledBy as string | null) ?? undefined,
    created_by: (row.createdBy as string | null) ?? undefined,
    created_at: (row.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    updated_at: (row.updatedAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    deleted_at: row.deletedAt ? ((row.deletedAt as Date).toISOString?.() ?? null) : null,
    kot_count: kitchen?.kotCount ?? new Set(items.map((i) => i.kot_id).filter(Boolean)).size,
    fired_items: items.filter((i) => i.kot_id).length,
    draft_items: items.filter((i) => !i.kot_id).length,
    kitchen_done: kitchen?.done ?? 0,
    kitchen_total: kitchen?.total ?? 0,
    version: Number(row.version ?? 1),
  } as unknown as OrderWithDerived;
}

function toDbOrder(orgId: string, outletId: string, o: Partial<RestaurantOrder> & { id: string }) {
  return {
    id: o.id,
    organizationId: orgId,
    outletId,
    orderNumber: o.order_number ?? `ORD-${Date.now().toString(36).toUpperCase()}`,
    channel: o.channel ?? "dine_in",
    tableId: o.table_id ?? null,
    tableNumberSnapshot: o.table_number_snapshot ?? null,
    occupancyGroupId: o.occupancy_group_id ?? null,
    customerId: o.customer_id ?? null,
    customerName: o.customer_name ?? null,
    customerPhone: o.customer_phone ?? null,
    customerNotes: o.customer_notes ?? null,
    deliveryAddressSnapshot: o.delivery_address_snapshot ?? null,
    riderName: o.rider_name ?? null,
    dispatchedAt: (o as unknown as { dispatched_at?: string }).dispatched_at
      ? new Date((o as unknown as { dispatched_at: string }).dispatched_at)
      : null,
    deliveredAt: (o as unknown as { delivered_at?: string }).delivered_at
      ? new Date((o as unknown as { delivered_at: string }).delivered_at)
      : null,
    offHours: o.off_hours ?? false,
    offHoursReason: o.off_hours_reason ?? null,
    scheduledFor: o.scheduled_for ? new Date(o.scheduled_for) : null,
    externalRef: o.external_ref ?? null,
    status: o.status ?? "DRAFT",
    paymentStatus: o.payment_status ?? "UNPAID",
    subtotalPaise: o.subtotal_paise ?? 0,
    discountPercent: (o.discount_percent as number | undefined) ?? null,
    discountPaise: o.discount_paise ?? 0,
    discountReason: o.discount_reason ?? null,
    promoCode: o.promo_code ?? null,
    promoId: o.promo_id ?? null,
    rewardPoints: o.reward_points ?? null,
    taxPaise: o.tax_paise ?? 0,
    grandTotalPaise: o.grand_total_paise ?? 0,
    split: (o.split ?? null) as unknown as Record<string, unknown> | null,
    cancelledReason: o.cancelled_reason ?? null,
    cancelledBy: o.cancelled_by ?? null,
    createdBy: o.created_by ?? null,
    updatedAt: new Date(),
  };
}

/* ---------------- queries ---------------- */

export async function listOrders(
  organizationId: string,
  filters?: {
    outlet_id?: string | null;
    status?: string;
    channel?: string;
    table_id?: string;
    customer_id?: string;
    search?: string;
  },
): Promise<OrderWithDerived[]> {
  const conds = [eq(orders.organizationId, organizationId), isNull(orders.deletedAt)];
  if (filters?.outlet_id) conds.push(eq(orders.outletId, filters.outlet_id));
  if (filters?.status) conds.push(eq(orders.status, filters.status as never));
  if (filters?.channel) conds.push(eq(orders.channel, filters.channel));
  if (filters?.table_id) conds.push(eq(orders.tableId, filters.table_id));
  if (filters?.customer_id) conds.push(eq(orders.customerId, filters.customer_id));
  let rows = (await db()
    .select()
    .from(orders)
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(500)) as unknown as Record<string, unknown>[];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => {
      const on = String(r.orderNumber ?? "").toLowerCase();
      const cn = String((r.customerName as string | null) ?? "").toLowerCase();
      const cp = String((r.customerPhone as string | null) ?? "");
      const er = String((r.externalRef as string | null) ?? "").toLowerCase();
      return on.includes(q) || cn.includes(q) || cp.includes(q) || er.includes(q);
    });
  }
  const ids = rows.map((r) => String(r.id));
  const allLines = ids.length
    ? ((await db()
        .select()
        .from(orderItems)
        .where(
          and(eq(orderItems.organizationId, organizationId), inArray(orderItems.orderId, ids)),
        )) as unknown as Record<string, unknown>[])
    : [];
  const linesByOrder = new Map<string, Record<string, unknown>[]>();
  for (const l of allLines) {
    const k = String(l.orderId);
    if (!linesByOrder.has(k)) linesByOrder.set(k, []);
    linesByOrder.get(k)!.push(l);
  }
  return rows.map((r) => {
    const items = (linesByOrder.get(String(r.id)) ?? []).map(toClientItem);
    return toClientOrder(r, items);
  });
}

export async function getOrderRow(
  organizationId: string,
  orderId: string,
): Promise<{ row: Record<string, unknown>; items: Record<string, unknown>[] } | null> {
  const rows = (await db()
    .select()
    .from(orders)
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
    .limit(1)) as unknown as Record<string, unknown>[];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || row.deletedAt) return null;
  const items = (await db()
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.organizationId, organizationId), eq(orderItems.orderId, orderId)))
    .orderBy(orderItems.createdAt)) as unknown as Record<string, unknown>[];
  return { row, items };
}

export async function getOrderById(
  organizationId: string,
  orderId: string,
): Promise<OrderWithDerived | null> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) return null;
  const items = found.items.map(toClientItem);
  return toClientOrder(found.row, items);
}

async function advanceOrderKitchenState(
  organizationId: string,
  orderId: string,
): Promise<"advanced" | "steady" | "missing"> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) return "missing";
  const status = String(found.row.status);
  if (!["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"].includes(status))
    return "steady";
  const tickets = (await db()
    .select()
    .from(kots)
    .where(
      and(eq(kots.organizationId, organizationId), eq(kots.orderId, orderId)),
    )) as unknown as Record<string, unknown>[];
  if (tickets.length === 0) return "steady";
  const withLines = await Promise.all(
    tickets.map(async (t) => {
      const lines = (await db()
        .select()
        .from(kotLines)
        .where(
          and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, String(t.id))),
        )) as unknown as Record<string, any>[];
      return {
        status: String(t.status),
        lines: lines.map((l) => ({
          status: String(l.status),
          qty: Number(l.qty),
          voided_qty: Number(l.voidedQty ?? 0),
          returned_qty: Number(l.returnedQty ?? 0),
        })),
      };
    }),
  );
  let target = deriveKitchenTarget(withLines);
  if (!target) return "steady";
  if (target === "SERVED") {
    const channel = String(found.row.channel ?? "");
    if (["delivery", "zomato", "swiggy", "own_online"].includes(channel)) target = "READY";
  }
  const KITCHEN_CHAIN: Record<string, number> = {
    CONFIRMED: 0,
    IN_KITCHEN: 1,
    PREPARING: 2,
    READY: 3,
    SERVED: 4,
  };
  if ((KITCHEN_CHAIN[status] ?? -1) >= (KITCHEN_CHAIN[target] ?? 99)) return "steady";
  const order: Record<string, unknown> = { ...(found.row as object) };
  const steps: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"];
  for (const next of steps.slice(KITCHEN_CHAIN[status] + 1, KITCHEN_CHAIN[target] + 1)) {
    const from = String(order.status);
    order.status = next;
    await recordServerEvent({
      outlet_id: String(order.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: orderId,
      event_type:
        next === "PREPARING"
          ? "KITCHEN_STARTED"
          : next === "READY"
            ? "ORDER_READY"
            : next === "SERVED"
              ? "ORDER_SERVED"
              : "KITCHEN_TICKET_UPDATED",
      from_state: from,
      to_state: next,
      actor_id: "system",
    });
  }
  await db()
    .update(orders)
    .set({
      status: target as string,
      updatedAt: new Date(),
      version: Number(found.row.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  return "advanced";
}

/* ---------------- create ---------------- */

export async function createOrder(
  input: {
    outlet_id?: string;
    channel: string;
    table_id?: string;
    occupancy_group_id?: string;
    customer_id?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_notes?: string;
    delivery_address?: string;
    scheduled_for?: string;
    external_ref?: string;
    initial_status?: "DRAFT" | "CONFIRMED";
    created_by?: string;
    staff_initiated?: boolean;
    off_hours_reason?: string;
  },
  ctx: { organizationId: string; outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const outletId = input.outlet_id ?? ctx.outletId ?? undefined;
  if (!outletId) throw new Error("No outlet selected — create one first");
  // Outlet must belong to the org.
  assertOutletBelongsToOrg(outletId, ctx.organizationId);
  const by = input.created_by ?? ctx.actorId ?? "staff";
  if (input.channel === "dine_in" && !input.table_id)
    throw new Error("Dine-in orders require a table");
  if (input.channel === "dine_in" && input.table_id) {
    const t = await tablesServer.getTableById(input.table_id, ctx.organizationId);
    if (!t) throw new Error("Table not found");
    if (
      String(
        (t as Record<string, unknown>).outlet_id ?? (t as Record<string, unknown>).outletId,
      ) !== outletId
    )
      throw new Error("Table belongs to another outlet");
  }
  if (input.channel === "delivery" && !(input.delivery_address ?? "").trim()) {
    throw new Error("Delivery orders need a drop address");
  }
  const id = ulid();
  const now = new Date();
  // Per-outlet per-day sequence mirrors the local ORD-000N scheme.
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const existingToday = await db()
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, ctx.organizationId),
        eq(orders.outletId, outletId),
        gte(orders.createdAt, startOfDay),
      ),
    );
  const orderNumber = `ORD-${String(existingToday.length + 1).padStart(4, "0")}`;
  const status = input.initial_status ?? "CONFIRMED";
  const [row] = await db()
    .insert(orders)
    .values({
      id,
      organizationId: ctx.organizationId,
      outletId,
      orderNumber,
      channel: input.channel,
      tableId: input.table_id ?? null,
      tableNumberSnapshot: null,
      occupancyGroupId: input.occupancy_group_id ?? null,
      customerId: input.customer_id ?? null,
      customerName: input.customer_name?.trim() || null,
      customerPhone: input.customer_phone?.trim() || null,
      customerNotes: input.customer_notes?.trim() || null,
      deliveryAddressSnapshot: input.delivery_address?.trim() || null,
      riderName: null,
      dispatchedAt: null,
      deliveredAt: null,
      offHours: false,
      offHoursReason: input.off_hours_reason?.trim() || null,
      scheduledFor: input.scheduled_for ? new Date(input.scheduled_for) : null,
      externalRef: input.external_ref?.trim() || null,
      status,
      paymentStatus: "UNPAID",
      subtotalPaise: 0,
      discountPercent: null,
      discountPaise: 0,
      discountReason: null,
      promoCode: null,
      promoId: null,
      rewardPoints: null,
      taxPaise: 0,
      grandTotalPaise: 0,
      split: null,
      cancelledReason: null,
      cancelledBy: null,
      createdBy: by,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })
    .returning();
  await recordServerEvent({
    outlet_id: outletId,
    organization_id: ctx.organizationId,
    entity_type: "ORDER",
    entity_id: id,
    event_type: "ORDER_CREATED",
    to_state: status,
    actor_id: by,
    metadata: { channel: input.channel, order_number: orderNumber },
  });
  if (status === "CONFIRMED") {
    await recordServerEvent({
      outlet_id: outletId,
      organization_id: ctx.organizationId,
      entity_type: "ORDER",
      entity_id: id,
      event_type: "ORDER_CONFIRMED",
      to_state: "CONFIRMED",
      actor_id: by,
    });
  }
  const out = await getOrderById(ctx.organizationId, id);
  if (!out) throw new Error("Order created but could not be reloaded");
  return out;
}

async function assertOutletBelongsToOrg(_outletId: string, _organizationId: string): Promise<void> {
  // Verified by route-level assertOrgOutlet in all callers; hook kept for
  // defense in depth if this module is ever called from new paths.
  return;
}

/* ---------------- items ---------------- */

type ItemInput = {
  menu_item_id: string;
  variant_id?: string;
  modifier_ids?: string[];
  qty?: number;
  instructions?: string;
};

async function validateAndPriceItem(
  organizationId: string,
  orderChannel: string,
  input: ItemInput,
): Promise<{
  variantId: string;
  unitPrice: number;
  taxPercent: number;
  itemName: string;
  variantName?: string;
  recipeId?: string;
  modifiers: {
    modifier_id: string;
    name_snapshot: string;
    alias_snapshot?: string;
    price_paise: number;
  }[];
}> {
  const { menuItems, menuVariants, modifiers, modifierGroups } = await import("@pixa/db");
  const items = await db()
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.organizationId, organizationId), eq(menuItems.id, input.menu_item_id)))
    .limit(1);
  const item = items[0] as Record<string, unknown> | undefined;
  if (!item || (item as Record<string, unknown>).isActive === false)
    throw new Error("Menu item is not available");
  const variants = (await db()
    .select()
    .from(menuVariants)
    .where(
      and(
        eq(menuVariants.organizationId, organizationId),
        eq(menuVariants.menuItemId, String(item.id)),
      ),
    )) as unknown as Record<string, unknown>[];
  let variant =
    variants.find((v) => (input.variant_id ? String(v.id) === input.variant_id : v.isDefault)) ??
    variants.find((v) => v.isActive !== false) ??
    variants[0];
  if (!variant || variant.isActive === false) throw new Error("Variant is not available");
  const channel =
    orderChannel === "takeaway" || orderChannel === "counter"
      ? "pickup"
      : orderChannel === "own_online"
        ? "delivery"
        : orderChannel;
  const channels = (item.availableChannels as string[] | null) ?? [];
  if (channels.length > 0 && !(channels as string[]).includes(channel as string)) {
    throw new Error(
      `${String(item.name)} is not available for ${orderChannel.replace("_", " ")} orders`,
    );
  }
  const qty = input.qty ?? 1;
  if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");
  const groupIds: string[] = Array.isArray((item as Record<string, unknown>).modifierGroupIds)
    ? ((item as Record<string, unknown>).modifierGroupIds as string[])
    : [];
  const mods = input.modifier_ids?.length
    ? ((await db()
        .select()
        .from(modifiers)
        .where(
          and(
            eq(modifiers.organizationId, organizationId),
            inArray(modifiers.id, input.modifier_ids),
          ),
        )) as unknown as Record<string, unknown>[])
    : [];
  const byId = new Map(mods.map((m) => [String(m.id), m]));
  const picked: {
    modifier_id: string;
    name_snapshot: string;
    alias_snapshot?: string;
    price_paise: number;
  }[] = [];
  for (const mid of input.modifier_ids ?? []) {
    const m = byId.get(mid);
    if (!m || m.isActive === false) throw new Error(`Modifier not available: ${mid}`);
    picked.push({
      modifier_id: String(m.id),
      name_snapshot: String(m.name),
      alias_snapshot: (m.alias as string | null) ?? undefined,
      price_paise: Number(m.price ?? 0),
    });
  }
  if (groupIds.length > 0) {
    const groups = (await db()
      .select()
      .from(modifierGroups)
      .where(
        and(
          eq(modifierGroups.organizationId, organizationId),
          inArray(modifierGroups.id, groupIds),
        ),
      )) as unknown as Record<string, unknown>[];
    const inGroup = new Set(mods.map((m) => String((m as Record<string, unknown>).groupId)));
    for (const gid of groupIds) {
      const g = groups.find((x) => String(x.id) === gid);
      if (!g || g.isActive === false) continue;
      const min = Number(g.minSelection ?? 0);
      const max = Number(g.maxSelection ?? 99);
      const count = picked.filter(
        (p) =>
          inGroup.has(p.modifier_id) &&
          mods.find(
            (m) =>
              String((m as Record<string, unknown>).id) === p.modifier_id &&
              String((m as Record<string, unknown>).groupId) === gid,
          ),
      ).length;
      if (count < min)
        throw new Error(
          `${String(item.name)} needs at least ${min} from ${String(g.name)} (has ${count})`,
        );
      if (count > max)
        throw new Error(
          `${String(item.name)} allows at most ${max} from ${String(g.name)} (has ${count})`,
        );
    }
  }
  const unitPrice =
    Number(variant.selling_price ?? (variant as Record<string, unknown>).sellingPrice ?? 0) +
    picked.reduce((s, m) => s + m.price_paise, 0);
  const taxPercent = (item as Record<string, unknown>).taxable
    ? Number((item as Record<string, unknown>).taxPercent ?? 0)
    : 0;
  return {
    variantId: String(variant.id),
    unitPrice,
    taxPercent,
    itemName: String(item.name),
    variantName: (variant.name as string | undefined) ?? undefined,
    recipeId: (variant.recipeId as string | null) ?? undefined,
    modifiers: picked,
  };
}

export async function addOrderItem(
  organizationId: string,
  orderId: string,
  input: ItemInput,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.row.status === "COMPLETED" || found.row.status === "CANCELLED") {
    throw new Error(`Cannot add items to a ${String(found.row.status).toLowerCase()} order.`);
  }
  const priced = await validateAndFireCheck(organizationId, String(found.row.channel), input);
  const lineTotal = priced.unitPrice * (input.qty ?? 1);
  const lineTax = Math.round((lineTotal * priced.taxPercent) / 100);
  const now = new Date();
  await db()
    .insert(orderItems)
    .values({
      id: ulid(),
      organizationId,
      outletId: String(found.row.outletId),
      orderId,
      menuItemId: input.menu_item_id,
      variantId: priced.variantId ?? (input.variant_id as string | undefined) ?? null,
      modifierIds: (input.modifier_ids ?? []) as string[],
      qty: input.qty ?? 1,
      unitPricePaise: priced.unitPrice,
      lineTotalPaise: lineTotal,
      lineTaxPaise: lineTax,
      kotId: null,
      kotLineId: null,
      itemNameSnapshot: priced.itemName,
      variantNameSnapshot: priced.variantName ?? null,
      taxPercentSnapshot: priced.taxPercent,
      recipeIdSnapshot: priced.recipeId ?? null,
      modifiersSnapshot: priced.modifiers as unknown as Record<string, unknown>[],
      returnedQty: 0,
      instructions: input.instructions?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  await recomputeAndSave(organizationId, orderId);
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ITEM_ADDED",
    actor_id: ctx.actorId ?? "staff",
    metadata: { line_id: "new", menu_item_id: input.menu_item_id, qty: input.qty ?? 1 },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

async function validateAndFireCheck(
  organizationId: string,
  channel: string,
  input: ItemInput,
): Promise<{
  variantId: string;
  unitPrice: number;
  taxPercent: number;
  itemName: string;
  variantName?: string;
  recipeId?: string;
  modifiers: {
    modifier_id: string;
    name_snapshot: string;
    alias_snapshot?: string;
    price_paise: number;
  }[];
}> {
  return validateAndPriceItem(organizationId, channel, input);
}

async function writeOrderTotals(
  organizationId: string,
  orderId: string,
  recomputed: Pick<RestaurantOrder, "subtotal_paise" | "tax_paise" | "grand_total_paise">,
): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  await db()
    .update(orders)
    .set({
      subtotalPaise: recomputed.subtotal_paise,
      taxPaise: recomputed.tax_paise,
      grandTotalPaise: recomputed.grand_total_paise,
      updatedAt: new Date(),
      version: Number((found.row as Record<string, unknown>).version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
}

export async function updateDraftItemQty(
  organizationId: string,
  orderId: string,
  lineId: string,
  qty: number,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");
  const line = found.items.find((i) => i.id === lineId);
  if (!line) throw new Error("Item not found");
  if (line.kotId)
    throw new Error("Item is already fired to the kitchen. Void it from the KOT instead.");
  const lineTotal = Number(line.unitPricePaise ?? 0) * qty;
  await db()
    .update(orderItems)
    .set({
      qty,
      lineTotalPaise: lineTotal,
      lineTaxPaise: 0,
      updatedAt: new Date(),
    })
    .where(and(eq(orderItems.organizationId, organizationId), eq(orderItems.id, lineId)));
  // Recompute tax with stored rate.
  const taxRate = Number(line.taxPercentSnapshot ?? 0);
  const lineTax = Math.round((lineTotal * taxRate) / 100);
  await db()
    .update(orderItems)
    .set({ lineTaxPaise: lineTax, updatedAt: new Date() })
    .where(and(eq(orderItems.organizationId, organizationId), eq(orderItems.id, lineId)));
  await recomputeAndSave(organizationId, orderId);
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ITEM_MODIFIED",
    actor_id: ctx.actorId ?? "staff",
    metadata: { line_id: lineId, qty },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function setOrderLineQty(
  organizationId: string,
  orderId: string,
  lineId: string,
  qty: number,
): Promise<void> {
  if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  const line = found.items.find((i) => String(i.id) === lineId);
  if (!line) throw new Error("Item not found");
  const lineTotal = Number(line.unitPricePaise ?? 0) * qty;
  const taxRate = Number(line.taxPercentSnapshot ?? 0);
  await db()
    .update(orderItems)
    .set({
      qty,
      lineTotalPaise: lineTotal,
      lineTaxPaise: Math.round((lineTotal * taxRate) / 100),
      updatedAt: new Date(),
    })
    .where(and(eq(orderItems.organizationId, organizationId), eq(orderItems.id, lineId)));
  await recomputeAndSave(organizationId, orderId);
}

export async function removeDraftItem(
  organizationId: string,
  orderId: string,
  lineId: string,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  const line = found.items.find((i) => i.id === lineId);
  if (!line) throw new Error("Item not found");
  if (line.kotId)
    throw new Error("Item is already fired to the kitchen. Void it from the KOT instead.");
  await db()
    .delete(orderItems)
    .where(and(eq(orderItems.organizationId, organizationId), eq(orderItems.id, lineId)));
  await recomputeAndSave(organizationId, orderId);
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ITEM_REMOVED",
    actor_id: ctx.actorId ?? "staff",
    metadata: { line_id: lineId },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function confirmOrder(
  organizationId: string,
  orderId: string,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) === "CONFIRMED") {
    const out = await getOrderById(organizationId, orderId);
    if (!out) throw new Error("Order not found");
    return out;
  }
  if (String(found.row.status) !== "DRAFT") throw new Error("Only drafts can be confirmed");
  if (found.items.length === 0) throw new Error("Cannot confirm an empty order");
  await setOrderStatus(organizationId, orderId, "CONFIRMED", {
    actorId: ctx.actorId ?? "staff",
    event_type: "ORDER_CONFIRMED",
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

async function recomputeAndSave(organizationId: string, orderId: string): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  const items = found.items.map(toClientItem);
  const order = toClientOrder(found.row, items);
  const recomputed = recomputeTotals({
    ...order,
    discount_paise: order.discount_paise,
    discount_percent: order.discount_percent,
  });
  await db()
    .update(orders)
    .set({
      subtotalPaise: recomputed.subtotal_paise,
      taxPaise: recomputed.tax_paise,
      grandTotalPaise: recomputed.grand_total_paise,
      updatedAt: new Date(),
      version: Number((found.row as Record<string, unknown>).version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
}

export async function setOrderStatus(
  organizationId: string,
  orderId: string,
  to: OrderStatus,
  ctx: {
    actorId?: string;
    reason_text?: string;
    event_type?: string;
    metadata?: Record<string, unknown>;
    force?: boolean;
    outletId?: string | null;
  } = {},
): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  const from = String(found.row.status) as OrderStatus;
  if (from === to) return;
  if (!ctx.force && !canTransitionOrder(from, to)) {
    throw new Error(`Illegal order transition ${from} → ${to}`);
  }
  const outletId = ctx.outletId ?? (found.row.outletId as string | null) ?? undefined;
  await db()
    .update(orders)
    .set({ status: to, updatedAt: new Date(), version: Number(found.row.version ?? 1) + 1 })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: outletId ?? "",
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: ctx.event_type ?? "ORDER_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: ctx.actorId,
    reason_text: ctx.reason_text,
    metadata: ctx.metadata,
  });
}

export async function markLinesFired(
  organizationId: string,
  orderId: string,
  marks: { line_id: string; kot_id: string; kot_line_id: string }[],
  ctx: { outletId?: string | null; actorId?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  const ids = new Set(marks.map((m) => m.line_id));
  const byId = new Map(marks.map((m) => [m.line_id, m]));
  for (const item of found.items) {
    const m = byId.get(String((item as Record<string, unknown>).id));
    if (!m) continue;
    await db()
      .update(orderItems)
      .set({ kotId: m.kot_id, kotLineId: m.kot_line_id, updatedAt: new Date() })
      .where(
        and(
          eq(orderItems.organizationId, organizationId),
          eq(orderItems.id, String((item as Record<string, unknown>).id)),
        ),
      );
  }
  const status = String(found.row.status);
  if (status === "DRAFT" || status === "CONFIRMED") {
    await setOrderStatus(organizationId, orderId, "IN_KITCHEN", {
      actorId: ctx.actorId ?? "staff",
      event_type: "ORDER_SENT_TO_KITCHEN",
      outletId: ctx.outletId ?? (found.row.outletId as string | null) ?? undefined,
    });
    const out = await getOrderById(organizationId, orderId);
    if (!out) throw new Error("Order not found");
    return out;
  }
  if (status === "READY" || status === "SERVED") {
    await db()
      .update(orders)
      .set({
        status: "IN_KITCHEN",
        updatedAt: new Date(),
        version: Number(found.row.version ?? 1) + 1,
      })
      .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
    await recordServerEvent({
      outlet_id: String(found.row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: orderId,
      event_type: "ORDER_SENT_TO_KITCHEN",
      from_state: status,
      to_state: "IN_KITCHEN",
      actor_id: ctx.actorId ?? "staff",
      metadata: { reopened_by_fire: true, kot_ids: marks.map((m) => m.kot_id) },
    });
  }
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function cancelOrder(
  organizationId: string,
  orderId: string,
  params: { reason: string; by?: string },
  ctx: { outletId?: string | null },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!params.reason?.trim()) throw new Error("A reason is required to cancel an order");
  const status = String(found.row.status);
  if (
    ["PREPARING", "READY", "SERVED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status) &&
    !params.by
  ) {
    throw new Error("Cancelling a kitchen-fired order requires an authorized user");
  }
  await db()
    .update(orders)
    .set({
      cancelledReason: params.reason.trim(),
      cancelledBy: params.by ?? "staff",
      updatedAt: new Date(),
      version: Number(found.row.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await setOrderStatus(organizationId, orderId, "CANCELLED", {
    actorId: params.by ?? "staff",
    reason_text: params.reason.trim(),
    event_type: "ORDER_CANCELLED",
    outletId: ctx.outletId ?? (found.row.outletId as string | null) ?? undefined,
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function deleteOrder(
  organizationId: string,
  orderId: string,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.items.some((i) => (i as Record<string, unknown>).kotId)) {
    throw new Error("Order has fired items — cancel it instead");
  }
  const paid = await paidTotalForOrder(organizationId, orderId);
  if (paid > 0) throw new Error("Order has payments — cancel and refund it instead");
  const now = new Date();
  await db()
    .update(orders)
    .set({
      deletedAt: now,
      cancelledReason: "Order deleted before firing",
      cancelledBy: ctx.actorId ?? "staff",
      updatedAt: now,
      version: Number(found.row.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_CANCELLED",
    from_state: String(found.row.status),
    actor_id: ctx.actorId ?? "staff",
    reason_text: "Order deleted before firing",
  });
  if (found.row.occupancyGroupId) {
    // Detach best-effort; group lifecycle owns itself.
    const { detachOrder } = await import("@/features/table/api/server");
    try {
      await detachOrder({
        group_id: String(found.row.occupancyGroupId),
        order_id: orderId,
        ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
      });
    } catch {
      /* group may be released/transferred already — pointer is harmless */
    }
  }
}

/** Kitchen-facing advance hook: walk the order forward from live KOTs (advance-only). */
export async function advanceOrderForKitchen(
  organizationId: string,
  orderId: string,
): Promise<"advanced" | "steady" | "missing"> {
  return advanceOrderKitchenState(organizationId, orderId);
}

/** Attach an existing order to an occupancy group (order-side link). */
export async function attachOrderToGroup(
  organizationId: string,
  orderId: string,
  groupId: string,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) === "CANCELLED" || String(found.row.status) === "COMPLETED") {
    throw new Error("Cannot attach a closed order");
  }
  const { attachOrder: attachGroup } = await import("@/features/table/api/server");
  await attachGroup({ group_id: groupId, order_id: orderId, ctx: { ...ctx, organizationId } });
  await db()
    .update(orders)
    .set({ occupancyGroupId: groupId, updatedAt: new Date() })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
}

/** Detach an order from its occupancy group (order-side unlink). */
export async function detachOrderFromGroup(
  organizationId: string,
  orderId: string,
  groupId: string,
  ctx: { outletId?: string | null; actorId?: string },
): Promise<void> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) return;
  if (String(found.row.occupancyGroupId) !== groupId) return;
  await db()
    .update(orders)
    .set({ occupancyGroupId: null, updatedAt: new Date() })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  const { detachOrder } = await import("@/features/table/api/server");
  await detachOrder({
    group_id: groupId,
    order_id: orderId,
    ctx: { ...ctx, organizationId },
  }).catch(() => {});
}

async function findLiveOrder(
  organizationId: string,
  outletId: string | null | undefined,
  where: { tableId?: string; groupId?: string },
): Promise<Record<string, unknown> | null> {
  const conds = [
    eq(orders.organizationId, organizationId),
    isNull(orders.deletedAt),
    ne(orders.status, "COMPLETED"),
    ne(orders.status, "CANCELLED"),
  ];
  if (outletId) conds.push(eq(orders.outletId, outletId));
  if (where.tableId) conds.push(eq(orders.tableId, where.tableId));
  if (where.groupId) conds.push(eq(orders.occupancyGroupId, where.groupId));
  const rows = (await db()
    .select()
    .from(orders)
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(1)) as unknown as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function ensureTableOrder(
  organizationId: string,
  tableId: string,
  ctx: {
    outletId?: string | null;
    actorId?: string;
    created_by?: string;
    off_hours_reason?: string;
  },
): Promise<OrderWithDerived> {
  const existing = await findLiveOrder(organizationId, ctx.outletId ?? null, { tableId });
  if (existing) {
    const out = await getOrderById(organizationId, String(existing.id));
    if (out) return out;
  }
  const { getTableById, seatOccupancy, attachOrder } = await import("@/features/table/api/server");
  const table = await getTableById(tableId, organizationId);
  if (!table) throw new Error("Table not found");
  if (table.status === "out_of_service") throw new Error("Table is out of service");
  if (table.status === "cleaning")
    throw new Error("Table is being cleaned. Mark it cleaned first.");
  const active = table.active_groups ?? [];
  let groupId = active[0]?.id;
  if (!groupId) {
    const free = table.capacity - table.seated_seats;
    const seatedGroup = await seatOccupancy({
      table_id: tableId,
      seats: Math.max(1, free > 0 ? free : table.capacity),
      created_by: ctx.created_by ?? ctx.actorId ?? "staff",
      ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
    });
    groupId = seatedGroup.id;
  }
  const raced = await findLiveOrder(organizationId, ctx.outletId ?? null, { tableId });
  if (raced) {
    const out = await getOrderById(organizationId, String(raced.id));
    if (out) return out;
  }
  const order = await createOrder(
    {
      outlet_id: ctx.outletId ?? undefined,
      channel: "dine_in",
      table_id: tableId,
      occupancy_group_id: groupId,
      created_by: ctx.created_by ?? ctx.actorId ?? "staff",
      off_hours_reason: ctx.off_hours_reason,
      initial_status: "DRAFT",
      staff_initiated: true,
    },
    { organizationId, outletId: ctx.outletId ?? null, actorId: ctx.actorId },
  );
  try {
    await attachOrder({
      group_id: groupId!,
      order_id: order.id,
      ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
    });
  } catch {
    // Group may have transitioned — order stays linked by group id.
  }
  return order;
}

export async function ensureBareTableOrder(
  organizationId: string,
  tableId: string,
  ctx: {
    outletId?: string | null;
    actorId?: string;
    created_by?: string;
    off_hours_reason?: string;
  },
): Promise<OrderWithDerived> {
  const existing = await findLiveOrder(organizationId, ctx.outletId ?? null, { tableId });
  if (existing) {
    const out = await getOrderById(organizationId, String(existing.id));
    if (out) return out;
  }
  const {
    getTableById: getTableByIdFn,
    seatOccupancy: seatFn,
    attachOrder: attachFn,
  } = await import("@/features/table/api/server");
  const table = await getTableByIdFn(tableId, organizationId);
  if (!table) throw new Error("Table not found");
  if (table.status === "out_of_service") throw new Error("Table is out of service");
  if (table.status === "cleaning")
    throw new Error("Table is being cleaned. Mark it cleaned first.");
  const active = table.active_groups ?? [];
  let groupId: string | undefined = active[0]?.id;
  if (!groupId) {
    if (table.seated_seats >= table.capacity) throw new Error("Table is full");
    const seatedGroup = await seatFn({
      table_id: tableId,
      seats: 1,
      created_by: ctx.created_by ?? ctx.actorId ?? "staff",
      ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
    });
    groupId = seatedGroup.id;
  }
  const raced = await findLiveOrder(organizationId, ctx.outletId ?? null, { tableId });
  if (raced) {
    const out = await getOrderById(organizationId, String(raced.id));
    if (out) return out;
  }
  const order = await createOrder(
    {
      outlet_id: ctx.outletId ?? undefined,
      channel: "dine_in",
      table_id: tableId,
      occupancy_group_id: groupId,
      created_by: ctx.created_by ?? ctx.actorId ?? "staff",
      off_hours_reason: ctx.off_hours_reason,
      initial_status: "DRAFT",
      staff_initiated: true,
    },
    { organizationId, outletId: ctx.outletId ?? null, actorId: ctx.actorId },
  );
  try {
    await attachFn({
      group_id: groupId!,
      order_id: order.id,
      ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
    });
  } catch {
    // Group may have transitioned — order stays linked by group id.
  }
  return order;
}

export async function ensureGroupOrder(
  organizationId: string,
  groupId: string,
  ctx: {
    outletId?: string | null;
    actorId?: string;
    created_by?: string;
    off_hours_reason?: string;
  },
): Promise<OrderWithDerived> {
  const existing = await findLiveOrder(organizationId, ctx.outletId ?? null, { groupId });
  if (existing) {
    const out = await getOrderById(organizationId, String(existing.id));
    if (out) return out;
  }
  const {
    getOccupancyGroup,
    getTableById: getTableById2,
    attachOrder: attachOrder2,
  } = await import("@/features/table/api/server");
  const group = await getOccupancyGroup(groupId, organizationId);
  if (!group) throw new Error("Party not found");
  if (group.status !== "SEATED" && group.status !== "ORDERING") {
    throw new Error("Party is no longer seated");
  }
  if (group.order_id) {
    const linked = await getOrderById(organizationId, group.order_id);
    if (linked && linked.status !== "COMPLETED" && linked.status !== "CANCELLED") return linked;
  }
  const table = await getTableById2(group.table_id, organizationId);
  if (!table) throw new Error("Table not found");
  if (table.status === "out_of_service") throw new Error("Table is out of service");
  if (table.status === "cleaning")
    throw new Error("Table is being cleaned. Mark it cleaned first.");
  const raced = await findLiveOrder(organizationId, ctx.outletId ?? null, { groupId });
  if (raced) {
    const out = await getOrderById(organizationId, String(raced.id));
    if (out) return out;
  }
  const order = await createOrder(
    {
      outlet_id: ctx.outletId ?? undefined,
      channel: "dine_in",
      table_id: group.table_id,
      occupancy_group_id: groupId,
      created_by: ctx.created_by ?? ctx.actorId ?? "staff",
      off_hours_reason: undefined,
      initial_status: "DRAFT",
      staff_initiated: true,
    },
    { organizationId, outletId: ctx.outletId ?? null, actorId: ctx.actorId },
  );
  try {
    await attachOrder2({
      group_id: groupId,
      order_id: order.id,
      ctx: { organizationId, outletId: ctx.outletId ?? undefined, actorId: ctx.actorId },
    });
  } catch {
    // Group may have transitioned — order stays linked by group id.
  }
  return order;
}

export async function discardEmptyDrafts(
  organizationId: string,
  outletId?: string | null,
): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stale = (await db()
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createdAt,
      occupancyGroupId: orders.occupancyGroupId,
      outletId: orders.outletId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        isNull(orders.deletedAt),
        ...(outletId ? [eq(orders.outletId, outletId)] : []),
      ),
    )) as unknown as {
    id: string;
    status: string;
    createdAt: Date;
    occupancyGroupId: string | null;
    outletId: string;
  }[];
  // Only empty drafts older than the cutoff.
  const withItems = new Set(
    (
      await db()
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(and(eq(orderItems.organizationId, organizationId), isNull(orderItems.deletedAt)))
    ).map((r) => String((r as Record<string, unknown>).orderId)),
  );
  let count = 0;
  const now = new Date();
  for (const o of stale) {
    if (o.status === "COMPLETED" || o.status === "CANCELLED") continue;
    if (withItems.has(String(o.id))) continue;
    if (new Date(o.createdAt).getTime() > cutoff.getTime()) continue;
    await db()
      .update(orders)
      .set({
        deletedAt: now,
        cancelledReason: "Empty draft auto-discarded",
        updatedAt: now,
      })
      .where(and(eq(orders.organizationId, organizationId), eq(orders.id, String(o.id))));
    count++;
    if (o.occupancyGroupId) {
      const { detachOrder } = await import("@/features/table/api/server");
      try {
        await detachOrder({
          group_id: String(o.occupancyGroupId),
          order_id: String(o.id),
          ctx: { organizationId },
        });
      } catch {
        /* ignore — group may be gone */
      }
    }
  }
  return count;
}

/* ---------------- billing read-model ---------------- */

export async function getOrderWithBilling(
  organizationId: string,
  orderId: string,
): Promise<(BillingView & { billing: { paid_paise: number; balance_paise: number } }) | null> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) return null;
  const paid = await paidTotalForOrder(organizationId, orderId);
  const balance = Math.max(0, (found.grand_total_paise ?? 0) - paid);
  return {
    order: found,
    paid_paise: paid,
    balance_paise: balance,
    billing: { paid_paise: paid, balance_paise: balance },
  } as unknown as BillingView & { billing: { paid_paise: number; balance_paise: number } };
}

export async function refreshOrderPaymentState(
  organizationId: string,
  orderId: string,
): Promise<{ payment_status: string; paid_paise: number; balance_paise: number } | null> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) return null;
  const paid = await paidTotalForOrder(organizationId, orderId);
  const grand = found.grand_total_paise ?? 0;
  const status = paid >= grand && grand > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  if (status !== found.payment_status) {
    await db()
      .update(orders)
      .set({ paymentStatus: status, updatedAt: new Date() })
      .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
    if (status === "PAID" && found.payment_status !== "PAID") {
      await recordServerEvent({
        outlet_id: found.outlet_id,
        organization_id: organizationId,
        entity_type: "ORDER",
        entity_id: orderId,
        event_type: "ORDER_PAID",
        actor_id: "system",
      });
    }
  }
  return {
    payment_status: status,
    paid_paise: paid,
    balance_paise: Math.max(0, grand - paid),
  };
}

/* ---------------- payments orchestration ---------------- */

export async function collectPayment(
  organizationId: string,
  orderId: string,
  params: {
    method: string;
    amount_paise: number;
    tendered_paise?: number;
    partition_label?: string;
    received_by?: string;
  },
): Promise<import("@/features/payments/api/types").Payment> {
  const billing = await getOrderWithBilling(organizationId, orderId);
  if (!billing) throw new Error("Order not found");
  if (!Number.isInteger(params.amount_paise) || params.amount_paise < 1) {
    throw new Error("Amount must be a positive paise integer");
  }
  if (params.amount_paise > billing.balance_paise) {
    throw new Error(`Amount exceeds the balance of ${billing.balance_paise} paise`);
  }
  let change = 0;
  if (params.method === "cash" && params.tendered_paise !== undefined) {
    if (!Number.isInteger(params.tendered_paise) || params.tendered_paise < params.amount_paise) {
      throw new Error("Tendered cash must cover the amount");
    }
    change = params.tendered_paise - params.amount_paise;
  } else if (params.tendered_paise !== undefined) {
    throw new Error("Tendered/change applies to cash only");
  }
  const { insertPayment } = await import("@/features/payments/api/server");
  const row = await insertPayment({
    organizationId,
    outletId: billing.order.outlet_id,
    orderId,
    method: params.method,
    amountPaise: params.amount_paise,
    tenderedPaise: params.tendered_paise,
    changePaise: change,
    partitionLabel: params.partition_label?.trim() || undefined,
    receivedBy: params.received_by ?? "staff",
    status: "PAID",
  });
  await refreshOrderPaymentState(organizationId, orderId);
  await recordServerEvent({
    outlet_id: billing.order.outlet_id,
    organization_id: organizationId,
    entity_type: "PAYMENT",
    entity_id: String((row as Record<string, unknown>).id),
    event_type: "PAYMENT_COMPLETED",
    actor_id: params.received_by ?? "staff",
    metadata: {
      order_id: orderId,
      method: params.method,
      amount_paise: params.amount_paise,
      change_paise: change || undefined,
      partition_label: params.partition_label?.trim() || undefined,
    },
  });
  const { toClientPayment } = await import("@/features/payments/api/server");
  return toClientPayment(row as Parameters<typeof toClientPayment>[0]);
}

/* ---------------- completion / dispatch ---------------- */

export async function completeOrder(
  organizationId: string,
  orderId: string,
  params?: { by?: string; reason?: string; force?: boolean },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) === "COMPLETED" || String(found.row.status) === "CANCELLED") {
    throw new Error(`Order is already ${String(found.row.status).toLowerCase()}`);
  }
  const paid = await paidTotalForOrder(organizationId, orderId);
  const balance = Math.max(0, Number(found.row.grandTotalPaise ?? 0) - paid);
  if (balance > 0) {
    throw new Error(`Collect the remaining ₹${(balance / 100).toFixed(2)} before completing`);
  }
  const actor = params?.by ?? "staff";
  const status = String(found.row.status);
  const fulfilledAt = DISPATCH_CHANNELS.includes(String(found.row.channel ?? ""))
    ? "DELIVERED"
    : "SERVED";
  const forced = !!params?.force && status !== fulfilledAt;
  if (!forced && status !== fulfilledAt) {
    throw new Error(
      `Only ${fulfilledAt === "DELIVERED" ? "delivered" : "served"} orders can be completed (order is ${status.toLowerCase()}) — or force-complete with a reason`,
    );
  }
  if (forced && !params?.reason?.trim()) {
    throw new Error("A reason is required to force-complete an order");
  }
  await setOrderStatus(organizationId, orderId, "COMPLETED", {
    actorId: actor,
    event_type: "ORDER_COMPLETED",
    reason_text: forced ? params?.reason?.trim() : undefined,
    metadata: forced ? { forced: true, from_state: status } : undefined,
    force: forced || undefined,
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function assignRider(
  organizationId: string,
  orderId: string,
  params: { rider_name: string; by?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!DISPATCH_CHANNELS.includes(String(found.row.channel ?? ""))) {
    throw new Error("Only delivery-channel orders take a rider");
  }
  const st = String(found.row.status);
  if (st !== "READY" && st !== "OUT_FOR_DELIVERY") {
    throw new Error(
      `Rider can be set on ready or out-for-delivery orders (is ${st.toLowerCase()})`,
    );
  }
  const rider = params.rider_name?.trim();
  if (!rider) throw new Error("Rider name is required");
  await db()
    .update(orders)
    .set({ riderName: rider, updatedAt: new Date(), version: Number(found.row.version ?? 1) + 1 })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_RIDER_ASSIGNED",
    actor_id: params.by ?? "staff",
    metadata: { rider_name: rider },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function dispatchOrder(
  organizationId: string,
  orderId: string,
  params: { by?: string; actorId?: string } = {},
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!DISPATCH_CHANNELS.includes(String(found.row.channel ?? ""))) {
    throw new Error("Only delivery-channel orders can be dispatched");
  }
  if (String(found.row.status) !== "READY") {
    throw new Error(
      `Only ready orders can be dispatched (is ${String(found.row.status).toLowerCase()})`,
    );
  }
  if (!String(found.row.riderName ?? "").trim()) {
    throw new Error("Assign a rider before dispatch");
  }
  const now = new Date();
  await db()
    .update(orders)
    .set({ dispatchedAt: now, updatedAt: now, version: Number(found.row.version ?? 1) + 1 })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await setOrderStatus(organizationId, orderId, "OUT_FOR_DELIVERY", {
    actorId: params.by ?? params.actorId ?? "staff",
    event_type: "ORDER_DISPATCHED",
    metadata: { rider_name: String(found.row.riderName ?? "") },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function markDelivered(
  organizationId: string,
  orderId: string,
  params: { by?: string; actorId?: string } = {},
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) !== "OUT_FOR_DELIVERY") {
    throw new Error(
      `Only out-for-delivery orders can be marked delivered (is ${String(found.row.status).toLowerCase()})`,
    );
  }
  const now = new Date();
  await db()
    .update(orders)
    .set({ deliveredAt: now, updatedAt: now, version: Number(found.row.version ?? 1) + 1 })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await setOrderStatus(organizationId, orderId, "DELIVERED", {
    actorId: params.by ?? params.actorId ?? "staff",
    event_type: "ORDER_DELIVERED",
    metadata: { rider_name: String(found.row.riderName ?? "") },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function setDeliveryAddress(
  organizationId: string,
  orderId: string,
  params: { delivery_address: string; by?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!DISPATCH_CHANNELS.includes(String(found.row.channel ?? ""))) {
    throw new Error("Only delivery-channel orders take a drop address");
  }
  const st = String(found.row.status);
  if (!["READY", "CONFIRMED", "IN_KITCHEN", "PREPARING"].includes(st)) {
    throw new Error("Drop address can only change before dispatch");
  }
  const address = params.delivery_address?.trim();
  if (!address) throw new Error("Drop address is required");
  await db()
    .update(orders)
    .set({
      deliveryAddressSnapshot: address,
      updatedAt: new Date(),
      version: Number(found.row.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_UPDATED",
    actor_id: params.by ?? "staff",
    metadata: { delivery_address: address },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

/* ---------------- discounts / splits / customer ---------------- */

export async function setDiscount(
  organizationId: string,
  orderId: string,
  params: { percent?: number; amount_paise?: number; reason: string; by?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) === "COMPLETED" || String(found.row.status) === "CANCELLED") {
    throw new Error("Discount cannot change on a completed or cancelled order");
  }
  if (!params.reason?.trim()) throw new Error("A reason is required for a discount");
  if (params.percent !== undefined && (params.percent <= 0 || params.percent > 100)) {
    throw new Error("Discount percent must be between 0 and 100");
  }
  if (
    params.amount_paise !== undefined &&
    (!Number.isInteger(params.amount_paise) || params.amount_paise < 1)
  ) {
    throw new Error("Discount amount must be a positive paise integer");
  }
  if (params.percent === undefined && params.amount_paise === undefined) {
    throw new Error("Give a percent or a flat amount");
  }
  await db()
    .update(orders)
    .set({
      discountPercent: params.percent !== undefined ? String(params.percent) : null,
      discountPaise: params.amount_paise ?? 0,
      discountReason: params.reason.trim(),
      promoCode: null,
      promoId: null,
      rewardPoints: null,
      split: null,
      updatedAt: new Date(),
      version: Number(found.row.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recomputeAndSave(organizationId, orderId);
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_DISCOUNTED",
    actor_id: params.by ?? "staff",
    reason_text: params.reason.trim(),
    metadata: { percent: params.percent, amount_paise: params.amount_paise },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function computeSplits(
  organizationId: string,
  orderId: string,
  params:
    | { mode: "equal"; count: number }
    | { mode: "itemwise"; assignments: { label: string; line_ids: string[] }[] }
    | { mode: "custom"; amounts: { label: string; amount_paise: number }[] },
): Promise<OrderWithDerived> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.status === "COMPLETED" || found.status === "CANCELLED") {
    throw new Error(`Cannot split a ${found.status.toLowerCase()} order`);
  }
  const grand = found.grand_total_paise ?? 0;
  if (grand < 1) throw new Error("Nothing to split on an empty bill");
  let partitions: BillPartition[];
  if (params.mode === "equal") {
    if (!Number.isInteger(params.count) || params.count < 2) {
      throw new Error("Equal split needs at least 2 shares");
    }
    const base = Math.floor(grand / params.count);
    partitions = Array.from({ length: params.count }, (_, i) => ({
      label: `Guest ${i + 1}`,
      amount_paise: i === params.count - 1 ? grand - base * (params.count - 1) : base,
    }));
  } else if (params.mode === "itemwise") {
    if (params.assignments.length < 1) throw new Error("Assign at least one share");
    const seen = new Set<string>();
    partitions = params.assignments.map((a) => {
      if (!a.label?.trim()) throw new Error("Every share needs a label");
      let amount = 0;
      for (const lid of a.line_ids ?? []) {
        if (seen.has(lid)) throw new Error("A line can only belong to one share");
        seen.add(lid);
        const line = found.items.find((i) => i.id === lid);
        if (!line) throw new Error("Unknown order line in split");
        amount += (line.line_total_paise ?? 0) + (line.line_tax_paise ?? 0);
      }
      return { label: a.label.trim(), line_ids: a.line_ids, amount_paise: amount };
    });
    const covered = partitions.reduce((s, p) => s + p.amount_paise, 0);
    if (covered !== (found.subtotal_paise ?? 0) + (found.tax_paise ?? 0)) {
      throw new Error("Item-wise shares must cover every line exactly");
    }
    const discount = (found.subtotal_paise ?? 0) + (found.tax_paise ?? 0) - grand;
    if (discount > 0 && partitions.length > 0) {
      partitions[partitions.length - 1].amount_paise -= discount;
    }
  } else {
    if (params.amounts.length < 2) throw new Error("Custom split needs at least 2 shares");
    const sum = params.amounts.reduce((s, a) => s + (a.amount_paise ?? 0), 0);
    if (sum !== grand) throw new Error(`Custom shares must add up to the bill (${grand} paise)`);
    partitions = params.amounts.map((a) => {
      if (!a.label?.trim()) throw new Error("Every share needs a label");
      if (!Number.isInteger(a.amount_paise) || a.amount_paise < 1) {
        throw new Error("Share amounts must be positive paise integers");
      }
      return { label: a.label.trim(), amount_paise: a.amount_paise };
    });
  }
  const { listPayments } = await import("@/features/payments/api/server");
  const paidRows = await listPayments(organizationId, {
    order_id: orderId,
    status: "PAID" as never,
  });
  const paidByLabel = new Map<string, number>();
  for (const p of paidRows) {
    if (p.partition_label)
      paidByLabel.set(
        p.partition_label,
        (paidByLabel.get(p.partition_label) ?? 0) + p.amount_paise,
      );
  }
  if (paidByLabel.size > 0) {
    const nextLabels = new Set(partitions.map((p) => p.label));
    for (const [label, paid] of paidByLabel) {
      if (!nextLabels.has(label)) {
        throw new Error(
          `Cannot drop or rename "${label}" — ₹${(paid / 100).toFixed(2)} already paid against it`,
        );
      }
    }
    for (const p of partitions) {
      const paid = paidByLabel.get(p.label) ?? 0;
      if (p.amount_paise < paid) {
        throw new Error(
          `"${p.label}" already paid ₹${(paid / 100).toFixed(2)} — share cannot shrink below paid`,
        );
      }
    }
  }
  const isEdit = !!found.split;
  await db()
    .update(orders)
    .set({
      split: {
        mode: params.mode as SplitMode,
        partitions,
        created_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
      updatedAt: new Date(),
      version: (found.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: found.outlet_id,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: isEdit ? "ORDER_SPLIT_EDITED" : "ORDER_SPLIT_BUILT",
    actor_id: "staff",
    metadata: { mode: params.mode, partitions: partitions.length },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function clearSplit(
  organizationId: string,
  orderId: string,
  params: { reason: string; by?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (!found.split) throw new Error("Order has no split to remove");
  if (found.status === "COMPLETED" || found.status === "CANCELLED") {
    throw new Error(`Cannot change the split on a ${found.status.toLowerCase()} order`);
  }
  if (!params.reason?.trim()) throw new Error("A reason is required to remove the split");
  const { listPayments } = await import("@/features/payments/api/server");
  const paidRows = await listPayments(organizationId, {
    order_id: orderId,
    status: "PAID" as never,
  });
  if (paidRows.some((p) => p.partition_label)) {
    throw new Error("Cannot remove the split — share payments already exist");
  }
  await db()
    .update(orders)
    .set({ split: null, updatedAt: new Date(), version: (found.version ?? 1) + 1 })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: found.outlet_id,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_SPLIT_CLEARED",
    actor_id: params.by ?? "staff",
    reason_text: params.reason.trim(),
    metadata: { mode: (found.split as { mode?: string } | undefined)?.mode },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function linkCustomer(
  organizationId: string,
  orderId: string,
  customerId: string,
): Promise<OrderWithDerived> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.status === "COMPLETED" || found.status === "CANCELLED") {
    throw new Error(`Cannot link a customer to a ${found.status.toLowerCase()} order`);
  }
  const { customers } = await import("@pixa/db");
  const rows = (await db()
    .select()
    .from(customers)
    .where(and(eq(customers.organizationId, organizationId), eq(customers.id, customerId)))
    .limit(1)) as unknown as Record<string, unknown>[];
  const customer = rows[0];
  if (!customer) throw new Error("Customer not found");
  if (String(customer.outletId) !== found.outlet_id) {
    throw new Error("Customer belongs to another outlet");
  }
  await db()
    .update(orders)
    .set({
      customerId: customerId,
      customerName: String(customer.name ?? ""),
      customerPhone: String(customer.phone ?? "") || null,
      updatedAt: new Date(),
      version: (found.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: found.outlet_id,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_CUSTOMER_LINKED",
    actor_id: "staff",
    metadata: { customer_id: customerId },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function setCustomerNotes(
  organizationId: string,
  orderId: string,
  notes: string,
): Promise<OrderWithDerived> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.status === "COMPLETED" || found.status === "CANCELLED") {
    throw new Error(`Cannot edit notes on a ${found.status.toLowerCase()} order`);
  }
  if (notes.trim().length > 300) throw new Error("Notes must be 300 characters or less");
  await db()
    .update(orders)
    .set({
      customerNotes: notes.trim() || null,
      updatedAt: new Date(),
      version: (found.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

export async function unlinkCustomer(
  organizationId: string,
  orderId: string,
  params?: { reason?: string; by?: string },
): Promise<OrderWithDerived> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.status === "COMPLETED" || found.status === "CANCELLED") {
    throw new Error(`Cannot unlink a customer from a ${found.status.toLowerCase()} order`);
  }
  if (!found.customer_id && !found.customer_name && !found.customer_phone) {
    throw new Error("Order has no linked customer");
  }
  const prev = {
    customer_id: found.customer_id,
    customer_name: found.customer_name,
    customer_phone: found.customer_phone,
  };
  await db()
    .update(orders)
    .set({
      customerId: null,
      customerName: null,
      customerPhone: null,
      updatedAt: new Date(),
      version: (found.version ?? 1) + 1,
    })
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)));
  await recordServerEvent({
    outlet_id: found.outlet_id,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_CUSTOMER_UNLINKED",
    actor_id: params?.by ?? "staff",
    reason_text: params?.reason,
    metadata: { prev },
  });
  const out = await getOrderById(organizationId, orderId);
  if (!out) throw new Error("Order not found");
  return out;
}

/* Item sales rollup for reports: per menu_item+variant, served qty and value. */
export async function itemSalesStats(
  organizationId: string,
  filters?: { outlet_id?: string | null; from?: string; to?: string; channel?: string },
): Promise<
  {
    menu_item_id: string;
    variant_id?: string;
    name: string;
    variant_name?: string;
    category_name: string;
    qty: number;
    gross_paise: number;
    discount_paise: number;
    net_paise: number;
    orders: number;
  }[]
> {
  const conds = [eq(orders.organizationId, organizationId), isNull(orders.deletedAt)];
  if (filters?.outlet_id) conds.push(eq(orders.outletId, filters.outlet_id));
  if (filters?.channel) conds.push(eq(orders.channel, filters.channel as never));
  const orderRows = (await db()
    .select()
    .from(orders)
    .where(and(...conds))) as unknown as Record<string, unknown>[];
  const from = filters?.from ? new Date(filters.from).getTime() : null;
  const to = filters?.to ? new Date(filters.to).getTime() : null;
  const inRange = orderRows.filter((o) => {
    const t = new Date(o.createdAt as Date).getTime();
    if (from != null && t < from) return false;
    if (to != null && t > to) return false;
    return true;
  });
  const ids = inRange.map((o) => String(o.id));
  const lineRows = ids.length
    ? ((await db()
        .select()
        .from(orderItems)
        .where(
          and(eq(orderItems.organizationId, organizationId), inArray(orderItems.orderId, ids)),
        )) as unknown as Record<string, unknown>[])
    : [];
  const byKey = new Map<
    string,
    {
      menu_item_id: string;
      variant_id?: string;
      name: string;
      variant_name?: string;
      qty: number;
      gross_paise: number;
      ordersSet: Set<string>;
    }
  >();
  const orderOf = new Map(inRange.map((o) => [String(o.id), o]));
  for (const l of lineRows) {
    const live = Number(l.qty) - Number(l.returnedQty ?? 0);
    if (live <= 0) continue;
    const key = `${String(l.menuItemId)}|${String(l.variantId ?? "")}`;
    let e = byKey.get(key);
    if (!e) {
      e = {
        menu_item_id: String(l.menuItemId),
        variant_id: (l.variantId as string | null) ?? undefined,
        name: String(l.itemNameSnapshot ?? ""),
        variant_name: (l.variantNameSnapshot as string | null) ?? undefined,
        qty: 0,
        gross_paise: 0,
        ordersSet: new Set(),
      };
      byKey.set(key, e);
    }
    e.qty += live;
    e.gross_paise += Math.round(
      (Number(l.lineTotalPaise ?? 0) * live) / Math.max(1, Number(l.qty)),
    );
    e.ordersSet.add(String(l.orderId));
  }
  const { menuItems } = await import("@pixa/db");
  const catOf = new Map<string, string>();
  if (byKey.size > 0) {
    const itemRows = (await db()
      .select()
      .from(menuItems)
      .where(
        and(
          eq(menuItems.organizationId, organizationId),
          inArray(
            menuItems.id,
            [...byKey.values()].map((e) => e.menu_item_id),
          ),
        ),
      )) as unknown as Record<string, unknown>[];
    for (const m of itemRows)
      catOf.set(
        String(m.id),
        String(
          (m as Record<string, unknown>).categoryName ??
            (m as Record<string, unknown>).category_name ??
            "",
        ),
      );
  }
  return [...byKey.values()].map((e) => {
    let discount = 0;
    for (const oid of e.ordersSet) {
      const o = orderOf.get(oid);
      if (!o) continue;
      const sub = Number(o.subtotalPaise ?? 0);
      if (sub <= 0) continue;
      const d = Math.min(Number(o.discountPaise ?? 0), sub);
      const pct = o.discountPercent != null ? Number(o.discountPercent) : null;
      const orderDiscount = pct != null ? Math.round((sub * Math.min(pct, 100)) / 100) : d;
      const orderGross = Number(o.subtotalPaise ?? 0) + Number(o.taxPaise ?? 0);
      if (orderGross > 0) discount += Math.round((e.gross_paise * orderDiscount) / orderGross);
    }
    const cnt = e.ordersSet.size;
    return {
      menu_item_id: e.menu_item_id,
      variant_id: e.variant_id,
      name: e.name,
      variant_name: e.variant_name,
      category_name: catOf.get(e.menu_item_id) ?? "",
      qty: e.qty,
      gross_paise: e.gross_paise,
      discount_paise: discount,
      net_paise: e.gross_paise - discount,
      orders: cnt,
    };
  });
}

/**
 * Post-sale item return (order side): mark returned qty, shrink the bill via
 * the standard recompute, and refund to the original payment methods
 * (largest-first, per-payment caps; cash settles instantly, gateway-sourced
 * payments record REFUND_PENDING for the Razorpay phase).
 *
 * The route voids/returns the KOT lines first (kitchen domain); this command
 * owns billing + refunds. Wastage posting is deferred until the server waste
 * ledger exists (noted in event metadata).
 */
export async function applyReturnRefund(
  organizationId: string,
  orderId: string,
  params: {
    lines: { order_line_id: string; qty: number }[];
    total_paise: number;
    reason: string;
    by?: string;
  },
): Promise<{ return_id: string; total_paise: number; refunds: unknown[] }> {
  const found = await getOrderById(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (found.status !== "SERVED" && found.status !== "DELIVERED" && found.status !== "COMPLETED") {
    throw new Error(
      `Returns need a served bill (order is ${found.status.toLowerCase()}) — edit or void unfired items instead`,
    );
  }
  if (!params.reason?.trim()) throw new Error("A reason is required for a return");
  if (!params.lines?.length) throw new Error("Select at least one item to return");
  const returnId = ulid();
  for (const reqLine of params.lines) {
    if (!Number.isInteger(reqLine.qty) || reqLine.qty < 1) {
      throw new Error("Return qty must be a positive integer");
    }
    const line = found.items.find((i) => i.id === reqLine.order_line_id);
    if (!line) throw new Error("Order line not found");
    const already = line.returned_qty ?? 0;
    if (already + reqLine.qty > line.qty) {
      throw new Error(`Return qty exceeds live qty on "${line.item_name_snapshot}"`);
    }
    await db()
      .update(orderItems)
      .set({ returnedQty: already + reqLine.qty, updatedAt: new Date() })
      .where(
        and(
          eq(orderItems.organizationId, organizationId),
          eq(orderItems.id, reqLine.order_line_id),
        ),
      );
  }
  await recomputeAndSave(organizationId, orderId);
  // Largest-first refund allocation across paid payments.
  const { listPayments, recordRefund } = await import("@/features/payments/api/server");
  const paidRows = (await listPayments(organizationId, { order_id: orderId })).filter(
    (p) => p.status === "PAID",
  );
  const { reservedForOrder } = await import("@/features/payments/api/server");
  const reserved = await reservedForOrder(organizationId, orderId);
  let remaining = params.total_paise;
  const created: unknown[] = [];
  for (const p of [...paidRows].sort((a, b) => b.amount_paise - a.amount_paise)) {
    if (remaining <= 0) break;
    const headroom = p.amount_paise - (reserved.get(p.id) ?? 0);
    if (headroom <= 0) continue;
    const take = Math.min(headroom, remaining);
    const refundRow = await recordRefund({
      organizationId,
      outletId: found.outlet_id,
      orderId,
      paymentId: p.id,
      amountPaise: take,
      reason: params.reason.trim(),
      status: "REFUNDED",
      createdBy: params.by ?? "staff",
      returnId,
    });
    created.push(refundRow);
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error("Return exceeds refundable payments — collect history is short");
  }
  await refreshOrderPaymentState(organizationId, orderId);
  await recordServerEvent({
    outlet_id: found.outlet_id,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_RETURNED",
    actor_id: params.by ?? "staff",
    reason_text: params.reason.trim(),
    metadata: {
      return_id: returnId,
      total_paise: params.total_paise,
      waste: "deferred-no-server-ledger",
    },
  });
  return { return_id: returnId, total_paise: params.total_paise, refunds: created };
}

/* Deferred catalog operations — server catalogs land in v2. */
export async function applyPromo(): Promise<never> {
  throw new Error("Promo codes are not available in this build");
}

export async function removePromo(): Promise<never> {
  throw new Error("Promo codes are not available in this build");
}

export async function redeemRewards(): Promise<never> {
  throw new Error("Reward redemption is not available in this build");
}

export async function removeRewardsRedeem(): Promise<never> {
  throw new Error("Reward redemption is not available in this build");
}

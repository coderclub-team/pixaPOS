import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import { toPaise } from "@/lib/money";
import { getMenuItemById, getModifiers } from "@/features/menu/api/service";
import { attachOrder, detachOrder, getTableById, seatOccupancy } from "@/features/table/api/service";
import { getCustomerById } from "@/features/customers/api/service";
import type {
  AddItemInput,
  BillPartition,
  BillingView,
  CreateOrderInput,
  OrderFilters,
  OrderItemSnapshot,
  OrderStatus,
  OrderWithDerived,
  RestaurantOrder,
  SplitMode,
} from "./types";

const ORDER_STORAGE_KEY = "pixaOrders";

let mockOrders: RestaurantOrder[] = [];

function saveOrders() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ orders: mockOrders }));
    } catch {}
  }
}

/** Backfill billing fields for orders stored before discounts/payments. */
function normalizeOrder(o: RestaurantOrder): RestaurantOrder {
  if (o.grand_total_paise === undefined || o.payment_status === undefined) {
    return recomputeTotals({ ...o, payment_status: o.payment_status ?? "UNPAID" });
  }
  return o;
}

function loadOrders(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.orders)) mockOrders = parsed.orders.map(normalizeOrder);
      }
    } catch {}
  }
}
loadOrders();

/** Explicit order transition map (docs/workflows.md §1). */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_KITCHEN", "CANCELLED"],
  IN_KITCHEN: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Release-locks-order rule: a dine-in order is editable only while its table
 * has active occupancy. Takeaway/delivery/online orders are unaffected.
 * Payments and refunds always stay open (separate axis).
 */
export async function assertTableOccupied(order: RestaurantOrder): Promise<void> {
  if (order.channel !== "dine_in" || !order.table_id) return;
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return;
  const table = await getTableById(order.table_id);
  if (!table) throw new Error("Table not found");
  if (table.active_groups.length === 0) {
    throw new Error("Table is unoccupied — the order is locked. Payments and refunds still work.");
  }
}

async function transitionOrder(
  idx: number,
  to: OrderStatus,
  ctx: { actor_id?: string; reason_text?: string; event_type?: any },
): Promise<void> {
  const current = mockOrders[idx];
  const from = current.status;
  if (from === to) return;
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Illegal order transition ${from} → ${to}`);
  }
  const now = new Date().toISOString();
  mockOrders[idx] = { ...current, status: to, updated_at: now, version: current.version + 1 };
  await recordEvent({
    outlet_id: current.outlet_id,
    entity_type: "ORDER",
    entity_id: current.id,
    event_type: ctx.event_type ?? "ORDER_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: ctx.actor_id,
    reason_text: ctx.reason_text,
  });
}

function discountFor(subtotal: number, order: RestaurantOrder): number {
  if (order.discount_paise !== undefined) return Math.min(order.discount_paise, subtotal);
  if (order.discount_percent !== undefined) {
    return Math.round((subtotal * Math.min(order.discount_percent, 100)) / 100);
  }
  return 0;
}

function recomputeTotals(order: RestaurantOrder): RestaurantOrder {
  const subtotal = order.items.reduce((s, i) => s + i.line_total_paise, 0);
  const rawTax = order.items.reduce((s, i) => s + i.line_tax_paise, 0);
  const discount = discountFor(subtotal, order);
  // Discount pre-tax: scale tax pro-rata on the discounted base.
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

function enrichOrder(order: RestaurantOrder): OrderWithDerived {
  return {
    ...order,
    fired_items: order.items.filter((i) => i.kot_id).length,
    draft_items: order.items.filter((i) => !i.kot_id).length,
    kot_count: new Set(order.items.map((i) => i.kot_id).filter(Boolean)).size,
  };
}

export async function getOrders(filters?: OrderFilters): Promise<OrderWithDerived[]> {
  await delay(300);
  let r = [...mockOrders].filter((o) => !o.deleted_at);
  if (filters?.outlet_id) r = r.filter((o) => o.outlet_id === filters.outlet_id);
  if (filters?.channel) r = r.filter((o) => o.channel === filters.channel);
  if (filters?.status) r = r.filter((o) => o.status === filters.status);
  if (filters?.table_id) r = r.filter((o) => o.table_id === filters.table_id);
  if (filters?.customer_id) r = r.filter((o) => o.customer_id === filters.customer_id);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.external_ref?.toLowerCase().includes(q),
    );
  }
  return r
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(enrichOrder);
}

export async function getOrderById(id: string): Promise<OrderWithDerived | null> {
  await delay(200);
  const o = mockOrders.find((o) => o.id === id && !o.deleted_at);
  return o ? enrichOrder(o) : null;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire("order-write");
  try {
    await delay(400);
    const outletId = input.outlet_id ?? "out_001";

    if (input.channel === "dine_in") {
      if (!input.table_id) throw new Error("Dine-in orders require a table");
      const table = await getTableById(input.table_id);
      if (!table) throw new Error("Table not found");
      if (table.outlet_id !== outletId) throw new Error("Table belongs to another outlet");
    } else {
      if (!input.customer_name?.trim() && !input.customer_phone?.trim()) {
        throw new Error("Takeaway, delivery and online orders require a customer name or phone");
      }
    }

    const dayOrders = mockOrders.filter(
      (o) => o.outlet_id === outletId && o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
    );
    const now = new Date().toISOString();
    const order: RestaurantOrder = {
      id: `ord_${Date.now().toString(36)}`,
      outlet_id: outletId,
      order_number: `ORD-${String(dayOrders.length + 1).padStart(4, "0")}`,
      channel: input.channel,
      table_id: input.table_id,
      table_number_snapshot: input.table_id
        ? (await getTableById(input.table_id))?.number
        : undefined,
      occupancy_group_id: input.occupancy_group_id,
      customer_name: input.customer_name?.trim() || undefined,
      customer_phone: input.customer_phone?.trim() || undefined,
      external_ref: input.external_ref?.trim() || undefined,
      status: "CONFIRMED",
      items: [],
      subtotal_paise: 0,
      tax_paise: 0,
      total_paise: 0,
      grand_total_paise: 0,
      payment_status: "UNPAID",
      created_by: input.created_by ?? "staff",
      created_at: now,
      updated_at: now,
      version: 1,
    };
    mockOrders.push(order);
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_CREATED",
      to_state: "CONFIRMED",
      actor_id: order.created_by,
      metadata: { channel: order.channel, order_number: order.order_number },
    });
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_CONFIRMED",
      to_state: "CONFIRMED",
      actor_id: order.created_by,
    });
    return enrichOrder(order);
  } finally {
    release();
  }
}

export async function addOrderItem(
  orderId: string,
  input: AddItemInput,
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status !== "CONFIRMED") {
      throw new Error(`Cannot add items to an order in ${order.status}.`);
    }
    await assertTableOccupied(order);

    const menuItem = await getMenuItemById(input.menu_item_id);
    if (!menuItem || !menuItem.is_active) throw new Error("Menu item is not available");
    const variant =
      menuItem.variants.find((v) => v.id === (input.variant_id ?? menuItem.variants[0]?.id)) ??
      menuItem.variants[0];
    if (!variant || !variant.is_active) throw new Error("Variant is not available");
    if (!menuItem.available_channels.includes(orderChannelToMenuChannel(order.channel))) {
      throw new Error(`${menuItem.name} is not available for ${order.channel.replace("_", " ")} orders`);
    }

    const qty = input.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");

    const allModifiers = await getModifiers();
    const modifiers = (input.modifier_ids ?? []).map((mid) => {
      const m = allModifiers.find((x) => x.id === mid && x.is_active);
      if (!m) throw new Error(`Modifier not available: ${mid}`);
      return { modifier_id: m.id, name_snapshot: m.name, price_paise: toPaise(m.price) };
    });

    const unitPrice = toPaise(variant.selling_price) + modifiers.reduce((s, m) => s + m.price_paise, 0);
    const taxPercent = menuItem.taxable ? (menuItem.tax_percent ?? 0) : 0;
    const lineTotal = unitPrice * qty;
    const lineTax = Math.round((lineTotal * taxPercent) / 100);
    const now = new Date().toISOString();
    const line: OrderItemSnapshot = {
      id: `oli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      menu_item_id: menuItem.id,
      variant_id: variant.id,
      item_name_snapshot: menuItem.name,
      variant_name_snapshot: menuItem.product_type === "variant" ? variant.name : undefined,
      unit_price_paise: unitPrice,
      tax_percent_snapshot: taxPercent,
      recipe_id_snapshot: variant.recipe_id,
      modifiers,
      qty,
      line_total_paise: lineTotal,
      line_tax_paise: lineTax,
      instructions: input.instructions?.trim() || undefined,
    };

    mockOrders[idx] = recomputeTotals({
      ...order,
      items: [...order.items, line],
      updated_at: now,
      version: order.version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ITEM_ADDED",
      actor_id: "staff",
      metadata: { line_id: line.id, menu_item_id: menuItem.id, qty },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

function orderChannelToMenuChannel(channel: CreateOrderInput["channel"]): "dine_in" | "pickup" | "delivery" | "zomato" | "swiggy" | "ondc" {
  if (channel === "takeaway") return "pickup";
  if (channel === "own_online") return "delivery";
  return channel;
}

export async function updateDraftItemQty(
  orderId: string,
  lineId: string,
  qty: number,
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    const lineIdx = order.items.findIndex((i) => i.id === lineId);
    if (lineIdx === -1) throw new Error("Item not found");
    const line = order.items[lineIdx];
    if (line.kot_id) {
      throw new Error("Item is already fired to the kitchen. Void it from the KOT instead.");
    }
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");
    await assertTableOccupied(order);
    const lineTotal = line.unit_price_paise * qty;
    const updated: OrderItemSnapshot = {
      ...line,
      qty,
      line_total_paise: lineTotal,
      line_tax_paise: Math.round((lineTotal * line.tax_percent_snapshot) / 100),
    };
    const items = [...order.items];
    items[lineIdx] = updated;
    mockOrders[idx] = recomputeTotals({
      ...order,
      items,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ITEM_MODIFIED",
      metadata: { line_id: lineId, qty },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Set an order line qty regardless of fired state. Only called from the KOT
 * flow (quantity increases on fired lines); draft edits keep using
 * updateDraftItemQty. Emits ITEM_MODIFIED for the audit trail.
 */
export async function setOrderLineQty(
  orderId: string,
  lineId: string,
  qty: number,
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(200);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    const lineIdx = order.items.findIndex((i) => i.id === lineId);
    if (lineIdx === -1) throw new Error("Item not found");
    const line = order.items[lineIdx];
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");
    await assertTableOccupied(order);
    const lineTotal = line.unit_price_paise * qty;
    const items = [...order.items];
    items[lineIdx] = {
      ...line,
      qty,
      line_total_paise: lineTotal,
      line_tax_paise: Math.round((lineTotal * line.tax_percent_snapshot) / 100),
    };
    mockOrders[idx] = recomputeTotals({
      ...order,
      items,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ITEM_MODIFIED",
      metadata: { line_id: lineId, qty },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

export async function removeDraftItem(orderId: string, lineId: string): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    const line = order.items.find((i) => i.id === lineId);
    if (!line) throw new Error("Item not found");
    if (line.kot_id) {
      throw new Error("Item is already fired to the kitchen. Void it from the KOT instead.");
    }
    await assertTableOccupied(order);
    mockOrders[idx] = recomputeTotals({
      ...order,
      items: order.items.filter((i) => i.id !== lineId),
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ITEM_REMOVED",
      metadata: { line_id: lineId },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Idempotent no-op for CONFIRMED orders (orders are created confirmed since
 * drafts were retired). Kept so existing callers don't break.
 */
export async function confirmOrder(orderId: string, by?: string): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    if (mockOrders[idx].status === "CONFIRMED") return enrichOrder(mockOrders[idx]);
    if (mockOrders[idx].status === "DRAFT") {
      if (mockOrders[idx].items.length === 0) throw new Error("Cannot confirm an empty order");
      await transitionOrder(idx, "CONFIRMED", { actor_id: by ?? "staff", event_type: "ORDER_CONFIRMED" });
      saveOrders();
    }
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/** Called by the kitchen module when a draft KOT is fired — do not call from UI. */
export async function markLinesFired(
  orderId: string,
  marks: { line_id: string; kot_id: string; kot_line_id: string }[],
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    const ids = new Set(marks.map((m) => m.line_id));
    const items = order.items.map((i) => {
      const m = marks.find((x) => x.line_id === i.id);
      return m ? { ...i, kot_id: m.kot_id, kot_line_id: m.kot_line_id } : i;
    });
    if (items.some((i) => ids.has(i.id) && !i.kot_id)) throw new Error("Line not found");
    mockOrders[idx] = {
      ...order,
      items,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    if (order.status === "CONFIRMED") {
      await transitionOrder(idx, "IN_KITCHEN", { event_type: "ORDER_SENT_TO_KITCHEN" });
    }
    saveOrders();
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

export async function cancelOrder(
  orderId: string,
  params: { reason: string; by?: string },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(400);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    if (!params.reason?.trim()) throw new Error("A reason is required to cancel an order");
    const order = mockOrders[idx];
    if (["PREPARING", "READY", "SERVED"].includes(order.status) && !params.by) {
      throw new Error("Cancelling a kitchen-fired order requires an authorized user");
    }
    mockOrders[idx] = { ...order, cancelled_reason: params.reason, cancelled_by: params.by ?? "staff" };
    await transitionOrder(idx, "CANCELLED", {
      actor_id: params.by ?? "staff",
      reason_text: params.reason,
      event_type: "ORDER_CANCELLED",
    });
    saveOrders();
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Terminal capture: return the table's live order, or auto-create a CONFIRMED
 * dine-in order and attach it to the active occupancy group. Seats a default
 * party (table capacity) when the table has no active group. Serialized under
 * the order-write lock so double-taps can't create two drafts.
 */
export async function ensureTableOrder(
  tableId: string,
  params?: { by?: string },
): Promise<OrderWithDerived> {
  // Per-table lock held for the whole flow (composed commands take their own
  // different keys, so no deadlock). Double-taps on one table serialize here.
  const release = await entityMutex.acquire(`order-table-${tableId}`);
  try {
    await delay(200);
    const findLive = () =>
      mockOrders
        .filter(
          (o) =>
            !o.deleted_at &&
            o.table_id === tableId &&
            o.status !== "COMPLETED" &&
            o.status !== "CANCELLED",
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const existing = findLive();
    if (existing) return enrichOrder(existing);

    const table = await getTableById(tableId);
    if (!table) throw new Error("Table not found");
    if (table.status === "out_of_service") throw new Error("Table is out of service");
    if (table.status === "cleaning") throw new Error("Table is being cleaned. Mark it cleaned first.");

    let groupId = table.active_groups[0]?.id;
    if (!groupId) {
      const free = table.capacity - table.seated_seats;
      const seated = await seatOccupancy({
        table_id: tableId,
        seats: Math.max(1, free > 0 ? free : table.capacity),
        created_by: params?.by ?? "staff",
      });
      groupId = seated.id;
    }

    const raced = findLive();
    if (raced) return enrichOrder(raced);

    const order = await createOrder({
      outlet_id: table.outlet_id,
      channel: "dine_in",
      table_id: tableId,
      occupancy_group_id: groupId,
      created_by: params?.by ?? "staff",
    });
    try {
      await attachOrder({ group_id: groupId, order_id: order.id });
    } catch {
      // Group may have transitioned (e.g. already ORDERING) — order stays linked by table_id.
    }
    return order;
  } finally {
    release();
  }
}

/**
 * Delete an unfired order (soft-delete). Allowed iff no line has fired to a
 * KOT, regardless of status — anything fired must go through cancelOrder.
 * Unlinks the occupancy group so release guards don't demand a force-release.
 */
export async function deleteOrder(orderId: string, by?: string): Promise<void> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  let groupId: string | undefined;
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.items.some((i) => i.kot_id)) {
      throw new Error("Order has fired items — cancel it instead");
    }
    groupId = order.occupancy_group_id;
    const now = new Date().toISOString();
    mockOrders[idx] = {
      ...order,
      deleted_at: now,
      cancelled_reason: "Order deleted before firing",
      cancelled_by: by ?? "staff",
      updated_at: now,
      version: order.version + 1,
    };
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_CANCELLED",
      from_state: order.status,
      actor_id: by ?? "staff",
      reason_text: "Order deleted before firing",
    });
  } finally {
    release();
  }
  if (groupId) {
    try {
      await detachOrder({ group_id: groupId, order_id: orderId });
    } catch {
      // Group already released/transferred — pointer is harmless.
    }
  }
}

/**
 * Link a customer record to an order. Snapshots name/phone onto the order so
 * later customer edits never rewrite history. Blocked on terminal states.
 */
export async function linkCustomer(
  orderId: string,
  customerId: string,
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot link a customer to a ${order.status.toLowerCase()} order`);
    }
    const customer = await getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.outlet_id !== order.outlet_id) {
      throw new Error("Customer belongs to another outlet");
    }
    mockOrders[idx] = {
      ...order,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_CUSTOMER_LINKED",
      actor_id: "staff",
      metadata: { customer_id: customer.id },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Bill-level discount (percent or flat paise, pre-tax). CONFIRMED only —
 * once fired, the bill is locked except via voids/refunds.
 */
export async function setDiscount(
  orderId: string,
  params: { percent?: number; amount_paise?: number; reason: string; by?: string },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status !== "CONFIRMED") {
      throw new Error("Discount can only change before firing to the kitchen");
    }
    await assertTableOccupied(order);
    if (!params.reason?.trim()) throw new Error("A reason is required for a discount");
    if (params.percent !== undefined && (params.percent <= 0 || params.percent > 100)) {
      throw new Error("Discount percent must be between 0 and 100");
    }
    if (params.amount_paise !== undefined && (!Number.isInteger(params.amount_paise) || params.amount_paise < 1)) {
      throw new Error("Discount amount must be a positive paise integer");
    }
    if (params.percent === undefined && params.amount_paise === undefined) {
      throw new Error("Give a percent or a flat amount");
    }
    mockOrders[idx] = recomputeTotals({
      ...order,
      discount_percent: params.percent,
      discount_paise: params.amount_paise,
      discount_reason: params.reason.trim(),
      split: undefined,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_DISCOUNTED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason.trim(),
      metadata: { percent: params.percent, amount_paise: params.amount_paise },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Partition the grand total for group sharing. Rounding residue (paise) goes
 * to the last partition — explicit rule. Splits are independent of firing.
 */
export async function computeSplits(
  orderId: string,
  params:
    | { mode: "equal"; count: number }
    | { mode: "itemwise"; assignments: { label: string; line_ids: string[] }[] }
    | { mode: "custom"; amounts: { label: string; amount_paise: number }[] },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    const grand = order.grand_total_paise;
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
        if (!a.label.trim()) throw new Error("Every share needs a label");
        let amount = 0;
        for (const lid of a.line_ids) {
          if (seen.has(lid)) throw new Error("A line can only belong to one share");
          seen.add(lid);
          const line = order.items.find((i) => i.id === lid);
          if (!line) throw new Error("Unknown order line in split");
          amount += line.line_total_paise + line.line_tax_paise;
        }
        return { label: a.label.trim(), line_ids: a.line_ids, amount_paise: amount };
      });
      const covered = partitions.reduce((s, p) => s + p.amount_paise, 0);
      if (covered !== order.subtotal_paise + order.tax_paise) {
        throw new Error("Item-wise shares must cover every line exactly");
      }
      // Fold the bill discount into the last share pro-rata (discount is pre-tax).
      const discount = order.subtotal_paise + order.tax_paise - grand;
      if (discount > 0 && partitions.length > 0) {
        partitions[partitions.length - 1].amount_paise -= discount;
      }
    } else {
      if (params.amounts.length < 2) throw new Error("Custom split needs at least 2 shares");
      const sum = params.amounts.reduce((s, a) => s + a.amount_paise, 0);
      if (sum !== grand) throw new Error(`Custom shares must add up to the bill (${grand} paise)`);
      partitions = params.amounts.map((a) => {
        if (!a.label.trim()) throw new Error("Every share needs a label");
        if (!Number.isInteger(a.amount_paise) || a.amount_paise < 1) {
          throw new Error("Share amounts must be positive paise integers");
        }
        return { label: a.label.trim(), amount_paise: a.amount_paise };
      });
    }

    mockOrders[idx] = {
      ...order,
      split: { mode: params.mode as SplitMode, partitions, created_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_SPLIT_BUILT",
      metadata: { mode: params.mode, partitions: partitions.length },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/** Billing read-model for the terminal: paid/balance via the payments ledger. */
export async function getOrderWithBilling(orderId: string): Promise<BillingView | null> {
  const order = mockOrders.find((o) => o.id === orderId && !o.deleted_at);
  if (!order) return null;
  const { paidTotalForOrder } = await import("@/features/payments/api/service");
  const paid = await paidTotalForOrder(orderId);
  return { order: normalizeOrder(order), paid_paise: paid, balance_paise: Math.max(0, order.grand_total_paise - paid) };
}

/** Re-derive payment_status after each payment/refund (called by payments). */
export async function refreshOrderPaymentState(orderId: string): Promise<void> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) return;
    const { paidTotalForOrder } = await import("@/features/payments/api/service");
    const paid = await paidTotalForOrder(orderId);
    const grand = mockOrders[idx].grand_total_paise;
    const status = paid >= grand && grand > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    const prev = mockOrders[idx].payment_status;
    mockOrders[idx] = { ...mockOrders[idx], payment_status: status };
    saveOrders();
    if (status === "PAID" && prev !== "PAID") {
      await recordEvent({
        outlet_id: mockOrders[idx].outlet_id,
        entity_type: "ORDER",
        entity_id: orderId,
        event_type: "ORDER_PAID",
      });
    }
  } finally {
    release();
  }
}

export { canTransitionOrder };

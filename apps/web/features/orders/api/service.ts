import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import { toPaise } from "@/lib/money";
import { getMenuItemById, getModifiers } from "@/features/menu/api/service";
import {
  attachOrder,
  detachOrder,
  getOccupancyGroup,
  getTableById,
  seatOccupancy,
} from "@/features/table/api/service";
import { getCustomerById } from "@/features/customers/api/service";
// Type-only: erased at runtime, so no module edge to the kitchen domain.
import type { KOTLineStatus, KOTStatus } from "@/features/kitchen/api/types";
import type {
  AddItemInput,
  BillPartition,
  BillingView,
  CreateOrderInput,
  OrderFilters,
  OrderItemSnapshot,
  OrderReturn,
  OrderReturnLine,
  OrderStatus,
  OrderWithDerived,
  RestaurantOrder,
  SplitMode,
} from "./types";

const ORDER_STORAGE_KEY = "pixaOrders";
const RETURN_STORAGE_KEY = "pixaReturns";

let mockOrders: RestaurantOrder[] = [];
let mockReturns: OrderReturn[] = [];

function saveReturns() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RETURN_STORAGE_KEY, JSON.stringify({ returns: mockReturns }));
    } catch {}
  }
}

function loadReturns(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(RETURN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.returns)) mockReturns = parsed.returns;
      }
    } catch {}
  }
}
loadReturns();

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

/** Explicit order transition map (docs/workflows.md §1). DRAFT is the
 * internal pre-fire cart (never shown — see OrderStatusText): first fire
 * walks it straight to IN_KITCHEN. CONFIRMED stays for stored history. */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "IN_KITCHEN", "CANCELLED"],
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
 * Occupancy independence: dine-in orders and their KOTs never check table
 * occupancy. Occupancy gates seating only (seatOccupancy, attachOrder, the
 * ensure-create paths). Releasing a party frees seats; its order stays open,
 * editable, and payable until payment + fulfillment complete it.
 */

async function transitionOrder(
  idx: number,
  to: OrderStatus,
  ctx: {
    actor_id?: string;
    reason_text?: string;
    event_type?: any;
    metadata?: Record<string, any>;
    force?: boolean;
  },
): Promise<void> {
  const current = mockOrders[idx];
  const from = current.status;
  if (from === to) return;
  // force skips the map for authorized jumps (e.g. force-complete); the
  // from/to pair is still recorded on the event.
  if (!ctx.force && !canTransitionOrder(from, to)) {
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
    metadata: ctx.metadata,
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
  // Returned qty is excluded pro-rata: the torn-off value leaves the bill.
  const live = (i: { qty: number; returned_qty?: number }) => i.qty - (i.returned_qty ?? 0);
  const subtotal = order.items.reduce(
    (s, i) => s + Math.round((i.line_total_paise * Math.max(0, live(i))) / Math.max(1, i.qty)),
    0,
  );
  const rawTax = order.items.reduce(
    (s, i) => s + Math.round((i.line_tax_paise * Math.max(0, live(i))) / Math.max(1, i.qty)),
    0,
  );
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

function enrichOrder(
  order: RestaurantOrder,
  kitchen?: { done: number; total: number },
): OrderWithDerived {
  return {
    ...order,
    fired_items: order.items.filter((i) => i.kot_id).length,
    draft_items: order.items.filter((i) => !i.kot_id).length,
    kot_count: new Set(order.items.map((i) => i.kot_id).filter(Boolean)).size,
    kitchen_done: kitchen?.done ?? 0,
    kitchen_total: kitchen?.total ?? 0,
  };
}

/**
 * Item progress per order from one tickets snapshot (single pass, no
 * per-order queries): READY/SERVED live lines over all live lines,
 * voided tickets excluded. Same derivation as useOrderKitchenProgress.
 */
function kitchenProgressMap(
  tickets: {
    order_id: string;
    status: KOTStatus;
    lines: { status: KOTLineStatus; qty: number; voided_qty: number; returned_qty?: number }[];
  }[],
): Map<string, { done: number; total: number }> {
  const map = new Map<string, { done: number; total: number }>();
  for (const t of tickets) {
    if (t.status === "CANCELLED") continue;
    let entry = map.get(t.order_id);
    if (!entry) {
      entry = { done: 0, total: 0 };
      map.set(t.order_id, entry);
    }
    for (const l of t.lines) {
      if (l.qty - l.voided_qty - (l.returned_qty ?? 0) <= 0) continue;
      entry.total++;
      if (l.status === "READY" || l.status === "SERVED") entry.done++;
    }
  }
  return map;
}

export async function getOrders(filters?: OrderFilters): Promise<OrderWithDerived[]> {
  await delay(300);
  loadOrders(); // localStorage is the shared source — reload so tabs/displays agree
  await backfillOrderKitchenStates(); // self-heal statuses frozen before propagation
  const { readTicketsSnapshot } = await import("@/features/kitchen/api/service");
  const progress = kitchenProgressMap(readTicketsSnapshot());
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
    .map((o) => enrichOrder(o, progress.get(o.id)));
}

export async function getOrderById(id: string): Promise<OrderWithDerived | null> {
  await delay(200);
  loadOrders();
  await backfillOrderKitchenStates();
  const o = mockOrders.find((o) => o.id === id && !o.deleted_at);
  if (!o) return null;
  const { readTicketsSnapshot } = await import("@/features/kitchen/api/service");
  return enrichOrder(o, kitchenProgressMap(readTicketsSnapshot()).get(o.id));
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
    }
    // Table-free orders (counter / takeaway / delivery / online) allow
    // anonymous tokens — customer name/phone is optional capture only.

    const dayOrders = mockOrders.filter(
      (o) =>
        o.outlet_id === outletId &&
        o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
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
      customer_notes: input.customer_notes?.trim() || undefined,
      external_ref: input.external_ref?.trim() || undefined,
      status: input.initial_status ?? "CONFIRMED",
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
      to_state: order.status,
      actor_id: order.created_by,
      metadata: { channel: order.channel, order_number: order.order_number },
    });
    if (order.status === "CONFIRMED") {
      await recordEvent({
        outlet_id: order.outlet_id,
        entity_type: "ORDER",
        entity_id: order.id,
        event_type: "ORDER_CONFIRMED",
        to_state: "CONFIRMED",
        actor_id: order.created_by,
      });
    }
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
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot add items to a ${order.status.toLowerCase()} order.`);
    }

    const menuItem = await getMenuItemById(input.menu_item_id);
    if (!menuItem || !menuItem.is_active) throw new Error("Menu item is not available");
    const variant =
      menuItem.variants.find((v) => v.id === (input.variant_id ?? menuItem.variants[0]?.id)) ??
      menuItem.variants[0];
    if (!variant || !variant.is_active) throw new Error("Variant is not available");
    if (!menuItem.available_channels.includes(orderChannelToMenuChannel(order.channel))) {
      throw new Error(
        `${menuItem.name} is not available for ${order.channel.replace("_", " ")} orders`,
      );
    }

    const qty = input.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a positive integer");

    const allModifiers = await getModifiers();
    const modifiers = (input.modifier_ids ?? []).map((mid) => {
      const m = allModifiers.find((x) => x.id === mid && x.is_active);
      if (!m) throw new Error(`Modifier not available: ${mid}`);
      return { modifier_id: m.id, name_snapshot: m.name, price_paise: toPaise(m.price) };
    });

    const unitPrice =
      toPaise(variant.selling_price) + modifiers.reduce((s, m) => s + m.price_paise, 0);
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

function orderChannelToMenuChannel(
  channel: CreateOrderInput["channel"],
): "dine_in" | "pickup" | "delivery" | "zomato" | "swiggy" | "ondc" {
  if (channel === "takeaway" || channel === "counter") return "pickup";
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
 * Idempotent no-op for CONFIRMED orders. Terminal fast paths create DRAFT
 * carts (first fire walks DRAFT → IN_KITCHEN directly), so this is kept for
 * legacy callers only — no new flow should confirm.
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
      await transitionOrder(idx, "CONFIRMED", {
        actor_id: by ?? "staff",
        event_type: "ORDER_CONFIRMED",
      });
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
    loadOrders(); // re-read under lock so a concurrent tab's write isn't clobbered
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const ids = new Set(marks.map((m) => m.line_id));
    // Fresh base: getters (with backfill) may have advanced this order while
    // we awaited — never branch or write from a stale snapshot.
    const base = mockOrders[idx];
    const items = base.items.map((i) => {
      const m = marks.find((x) => x.line_id === i.id);
      return m ? { ...i, kot_id: m.kot_id, kot_line_id: m.kot_line_id } : i;
    });
    if (items.some((i) => ids.has(i.id) && !i.kot_id)) throw new Error("Line not found");
    mockOrders[idx] = {
      ...base,
      items,
      updated_at: new Date().toISOString(),
      version: base.version + 1,
    };
    const order = mockOrders[idx];
    if (order.status === "DRAFT" || order.status === "CONFIRMED") {
      if (order.status === "DRAFT" && order.channel === "dine_in" && order.table_id) {
        // First-fire auto-seat: the cart never required occupancy, but a
        // fired dine-in order must sit on an active group (terminal parity).
        const table = await getTableById(order.table_id);
        if (table && table.active_groups.length === 0) {
          const free = table.capacity - table.seated_seats;
          const seated = await seatOccupancy({
            table_id: table.id,
            seats: Math.max(1, free > 0 ? free : table.capacity),
            created_by: order.created_by ?? "staff",
          });
          try {
            await attachOrder({ group_id: seated.id, order_id: order.id });
          } catch {
            // Group transitioned mid-flight — table_id linkage stands.
          }
          mockOrders[idx] = { ...mockOrders[idx], occupancy_group_id: seated.id };
        }
      }
      await transitionOrder(idx, "IN_KITCHEN", { event_type: "ORDER_SENT_TO_KITCHEN" });
    } else if (order.status === "READY" || order.status === "SERVED") {
      // Add-on fire (Aloha rule): new food on a settled order re-opens it —
      // the kitchen is cooking again, so READY/SERVED would lie. Backward
      // edges don't exist in the machine; this explicit, audited step-back is
      // the only regression path. COMPLETED/CANCELLED never reach here
      // (addOrderItem blocks them).
      const now = new Date().toISOString();
      mockOrders[idx] = {
        ...mockOrders[idx],
        status: "IN_KITCHEN",
        updated_at: now,
        version: mockOrders[idx].version + 1,
      };
      await recordEvent({
        outlet_id: order.outlet_id,
        entity_type: "ORDER",
        entity_id: order.id,
        event_type: "ORDER_SENT_TO_KITCHEN",
        from_state: order.status,
        to_state: "IN_KITCHEN",
        metadata: { reopened_by_fire: true, kot_ids: marks.map((m) => m.kot_id) },
      });
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
    mockOrders[idx] = {
      ...order,
      cancelled_reason: params.reason,
      cancelled_by: params.by ?? "staff",
    };
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
 * Terminal capture: return the table's live order, or auto-create a DRAFT
 * dine-in order and attach it to the active occupancy group. Drafts stay
 * local (deletable, never synced) until the first fire. Seats a default
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
    if (table.status === "cleaning")
      throw new Error("Table is being cleaned. Mark it cleaned first.");

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
      // Terminal carts start as local DRAFTs (zero KOTs, deletable, never
      // synced) — the first fire walks DRAFT → IN_KITCHEN directly.
      initial_status: "DRAFT",
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
 * Bare-single twin of ensureTableOrder: return the table's live order, or
 * seat one silent 1-guest group (no seating ceremony, no guest-count step)
 * and create + attach its order. Terminal taps land here; the explicit seat
 * dialog stays the full party flow. Serialized per table like ensureTableOrder.
 */
export async function ensureBareTableOrder(
  tableId: string,
  params?: { by?: string },
): Promise<OrderWithDerived> {
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
    if (table.status === "cleaning")
      throw new Error("Table is being cleaned. Mark it cleaned first.");

    let groupId = table.active_groups[0]?.id;
    if (!groupId) {
      if (table.seated_seats >= table.capacity) throw new Error("Table is full");
      const seated = await seatOccupancy({
        table_id: tableId,
        seats: 1,
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
      // Terminal carts start as local DRAFTs (zero KOTs, deletable, never
      // synced) — the first fire walks DRAFT → IN_KITCHEN directly.
      initial_status: "DRAFT",
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
 * Party-scoped twin of ensureTableOrder: return the occupancy group's live
 * order, or create a CONFIRMED dine-in order and attach it to the group.
 * This is how shared tables serve one order per party — the press-and-hold
 * gesture on a party chip lands here. Serialized per group so double
 * holds can't create two orders.
 */
export async function ensureGroupOrder(
  groupId: string,
  params?: { by?: string },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-group-${groupId}`);
  try {
    await delay(200);
    const findLive = () =>
      mockOrders
        .filter(
          (o) =>
            !o.deleted_at &&
            o.occupancy_group_id === groupId &&
            o.status !== "COMPLETED" &&
            o.status !== "CANCELLED",
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const existing = findLive();
    if (existing) return enrichOrder(existing);

    const group = getOccupancyGroup(groupId);
    if (!group) throw new Error("Party not found");
    if (group.status !== "SEATED" && group.status !== "ORDERING") {
      throw new Error("Party is no longer seated");
    }
    if (group.order_id) {
      const linked = mockOrders.find((o) => o.id === group.order_id && !o.deleted_at);
      if (linked && linked.status !== "COMPLETED" && linked.status !== "CANCELLED") {
        return enrichOrder(linked);
      }
    }

    const table = await getTableById(group.table_id);
    if (!table) throw new Error("Table not found");
    if (table.status === "out_of_service") throw new Error("Table is out of service");
    if (table.status === "cleaning")
      throw new Error("Table is being cleaned. Mark it cleaned first.");

    const raced = findLive();
    if (raced) return enrichOrder(raced);

    const order = await createOrder({
      outlet_id: group.outlet_id,
      channel: "dine_in",
      table_id: group.table_id,
      occupancy_group_id: groupId,
      created_by: params?.by ?? "staff",
      initial_status: "DRAFT",
    });
    try {
      await attachOrder({ group_id: groupId, order_id: order.id });
    } catch {
      // Group may have transitioned (e.g. already ORDERING) — order stays linked by group id.
    }
    return order;
  } finally {
    release();
  }
}

/**
 * Sync eligibility for the server database: an order may leave the device
 * only once at least one line has fired to a KOT. Zero-KOT drafts (any
 * status) and deleted orders stay local-only — creatable and deletable
 * freely, never synced. Synchronous, no delays: safe to call from the
 * event/outbox path. Fired-then-cancelled orders stay eligible (the server
 * needs the cancel and its waste impact).
 */
export function orderSyncEligible(orderId: string): boolean {
  loadOrders();
  const o = mockOrders.find((m) => m.id === orderId);
  if (!o || o.deleted_at) return false;
  if (o.status === "DRAFT") return false;
  return o.items.some((i) => i.kot_id);
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
    // Money guard: a prepaid-but-unfired order must go through cancel/refund
    // so the payment trail survives — discarding would erase what the
    // customer paid. Dynamic import: payments/service imports this module.
    const { getPayments } = await import("@/features/payments/api/service");
    const paid = (await getPayments({ order_id: orderId }))
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount_paise, 0);
    if (paid > 0) {
      throw new Error("Order has payments — cancel and refund it instead");
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

export async function getReturnsByOrder(orderId: string): Promise<OrderReturn[]> {
  loadReturns();
  return mockReturns
    .filter((r) => r.order_id === orderId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({ ...r }));
}

/**
 * Item-wise post-sale return. Returns own kitchen truth (returnKOTLine works
 * on served lines, routes waste), shrink the bill (returned qty excluded from
 * totals), and refund to the original payment methods (refundForReturn).
 * Allowed on SERVED and COMPLETED orders — the bill must exist to be reduced.
 * Terminal CANCELLED orders go through cancel semantics, not returns.
 */
export async function createReturn(
  orderId: string,
  params: { lines: { order_line_id: string; qty: number }[]; reason: string; by?: string },
): Promise<{ order: OrderWithDerived; ret: OrderReturn }> {
  if (!params.reason?.trim()) throw new Error("A reason is required for a return");
  if (!params.lines?.length) throw new Error("Select at least one item to return");
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    loadOrders();
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status !== "SERVED" && order.status !== "COMPLETED") {
      throw new Error(
        `Returns need a served bill (order is ${order.status.toLowerCase()}) — edit or void unfired items instead`,
      );
    }
    const by = params.by ?? "staff";
    const kitchen = await import("@/features/kitchen/api/service");
    const tickets = kitchen.peekTickets().filter((t) => t.order_id === orderId);
    const returnLines: OrderReturnLine[] = [];

    for (const req of params.lines) {
      const ol = order.items.find((i) => i.id === req.order_line_id);
      if (!ol) throw new Error("Order line not found");
      if (!ol.kot_id || !ol.kot_line_id) {
        throw new Error(`"${ol.item_name_snapshot}" never fired — edit or void it instead`);
      }
      if (!Number.isInteger(req.qty) || req.qty < 1) {
        throw new Error("Return qty must be a positive integer");
      }
      const voidedOnKots = tickets
        .flatMap((t) => t.lines)
        .filter((l) => l.order_line_id === ol.id)
        .reduce((s, l) => s + l.voided_qty, 0);
      const returnable = ol.qty - (ol.returned_qty ?? 0) - voidedOnKots;
      if (req.qty > returnable) {
        throw new Error(
          `"${ol.item_name_snapshot}" has only ${returnable} returnable (of ${ol.qty})`,
        );
      }
      const amount = Math.round((ol.line_total_paise * req.qty) / ol.qty);
      const tax = Math.round((ol.line_tax_paise * req.qty) / ol.qty);
      const ticket = tickets.find((t) => t.id === ol.kot_id);
      const kotLine = ticket?.lines.find((l) => l.id === ol.kot_line_id);
      if (!ticket || !kotLine) throw new Error("Fired ticket not found for this line");
      await kitchen.returnKOTLine(ticket.id, kotLine.id, {
        qty: req.qty,
        amount_paise: amount + tax,
        reason: params.reason.trim(),
        by,
      });
      const itemIdx = mockOrders[idx].items.findIndex((i) => i.id === ol.id);
      mockOrders[idx].items[itemIdx] = {
        ...mockOrders[idx].items[itemIdx],
        returned_qty: (mockOrders[idx].items[itemIdx].returned_qty ?? 0) + req.qty,
      };
      returnLines.push({ order_line_id: ol.id, qty: req.qty, amount_paise: amount + tax });
    }

    const now = new Date().toISOString();
    const total = returnLines.reduce((s, l) => s + l.amount_paise, 0);
    const ret: OrderReturn = {
      id: `ordret_${Date.now().toString(36)}`,
      order_id: orderId,
      outlet_id: order.outlet_id,
      lines: returnLines,
      total_paise: total,
      reason: params.reason.trim(),
      created_by: by,
      created_at: now,
    };
    loadReturns();
    mockReturns.push(ret);
    saveReturns();
    mockOrders[idx] = recomputeTotals({
      ...mockOrders[idx],
      updated_at: now,
      version: mockOrders[idx].version + 1,
    });
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: orderId,
      event_type: "ITEM_RETURNED",
      actor_id: by,
      reason_text: params.reason.trim(),
      metadata: {
        return_id: ret.id,
        lines: returnLines.map((l) => ({ order_line_id: l.order_line_id, qty: l.qty })),
        total_paise: total,
      },
    });
    const { refundForReturn } = await import("@/features/payments/api/service");
    await refundForReturn(orderId, {
      return_id: ret.id,
      total_paise: total,
      reason: params.reason.trim(),
      by,
    });
    await refreshOrderPaymentState(orderId);
    return { order: enrichOrder(mockOrders[idx]), ret };
  } finally {
    release();
  }
}

/**
 * Link a customer record to an order. Snapshots name/phone onto the order so
 * later customer edits never rewrite history. Blocked on terminal states.
 */
export async function linkCustomer(orderId: string, customerId: string): Promise<OrderWithDerived> {
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
 * Unlink a customer record from an order (wrong entry by staff — unlink and
 * link again). Clears the snapshot; the customer record itself is untouched.
 * Blocked on terminal states. Audited with the previous customer in metadata.
 */
/**
 * Set free-text customer notes (allergies, accessibility, requests) on a
 * live order. Editable until COMPLETED/CANCELLED — the kitchen reads them
 * off every KOT print, so late allergy flags still land safely.
 */
export async function setCustomerNotes(orderId: string, notes: string): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    loadOrders();
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot edit notes on a ${order.status.toLowerCase()} order`);
    }
    if (notes.trim().length > 300) throw new Error("Notes must be 300 characters or less");
    mockOrders[idx] = {
      ...order,
      customer_notes: notes.trim() || undefined,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    saveOrders();
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

export async function unlinkCustomer(
  orderId: string,
  params?: { reason?: string; by?: string },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot unlink a customer from a ${order.status.toLowerCase()} order`);
    }
    if (!order.customer_id && !order.customer_name && !order.customer_phone) {
      throw new Error("Order has no linked customer");
    }
    const prev = {
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
    };
    mockOrders[idx] = {
      ...order,
      customer_id: undefined,
      customer_name: undefined,
      customer_phone: undefined,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_CUSTOMER_UNLINKED",
      actor_id: params?.by ?? "staff",
      reason_text: params?.reason,
      metadata: { prev },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Bill-level discount (percent or flat paise, pre-tax). Editable in any
 * non-terminal state — paid/balance re-derive from the ledger. If a discount
 * drops the grand below paid, the balance clamps at 0 and the difference is
 * an overpayment to refund explicitly (no auto-refund).
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
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
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
 *
 * Guarded edit: rebuilding over an existing split is allowed in any
 * non-terminal state, but a share can never shrink below its already-paid
 * amount (payments are immutable) and a label carrying payments can never be
 * renamed or dropped (partition_label has no FK — orphaned labels would
 * strand the ledger join). Emits ORDER_SPLIT_EDITED on rebuild, else
 * ORDER_SPLIT_BUILT. No occupancy guard — splits partition payment, and
 * payments stay open when release-locked.
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
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot split a ${order.status.toLowerCase()} order`);
    }
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

    // Guarded edit: validate against immutable payment rows BEFORE writing.
    const { getPayments } = await import("@/features/payments/api/service");
    const paidByLabel = new Map<string, number>();
    for (const p of await getPayments({ order_id: orderId, status: "PAID" })) {
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

    const isEdit = !!order.split;
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
      event_type: isEdit ? "ORDER_SPLIT_EDITED" : "ORDER_SPLIT_BUILT",
      metadata: { mode: params.mode, partitions: partitions.length },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * Remove the active split. Blocked on terminal orders and whenever any PAID
 * payment carries a share label — deleting would orphan the ledger join
 * (partition_label has no FK). Discounts still wipe label-less splits via
 * setDiscount; this is the explicit, audited removal path.
 */
export async function clearSplit(
  orderId: string,
  params: { reason: string; by?: string },
): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (!order.split) throw new Error("Order has no split to remove");
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Cannot change the split on a ${order.status.toLowerCase()} order`);
    }
    if (!params.reason?.trim()) throw new Error("A reason is required to remove the split");
    const { getPayments } = await import("@/features/payments/api/service");
    const labelled = (await getPayments({ order_id: orderId, status: "PAID" })).filter(
      (p) => p.partition_label,
    );
    if (labelled.length > 0) {
      throw new Error("Cannot remove the split — share payments already exist");
    }
    const prev = order.split;
    mockOrders[idx] = {
      ...order,
      split: undefined,
      updated_at: new Date().toISOString(),
      version: order.version + 1,
    };
    saveOrders();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_SPLIT_CLEARED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason.trim(),
      metadata: { mode: prev.mode, partitions: prev.partitions.length },
    });
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/** Billing read-model for the terminal: paid/balance via the payments ledger. */
export async function getOrderWithBilling(orderId: string): Promise<BillingView | null> {
  loadOrders();
  const order = mockOrders.find((o) => o.id === orderId && !o.deleted_at);
  if (!order) return null;
  const { paidTotalForOrder } = await import("@/features/payments/api/service");
  const paid = await paidTotalForOrder(orderId);
  return {
    order: normalizeOrder(order),
    paid_paise: paid,
    balance_paise: Math.max(0, order.grand_total_paise - paid),
  };
}

/** Re-derive payment_status after each payment/refund (called by payments). */
export async function refreshOrderPaymentState(orderId: string): Promise<void> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    loadOrders(); // caller holds payment writes, never order writes — safe
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) return;
    // peek (memory, no reload): the just-recorded payment/refund is still
    // un-persisted in the caller's frame — reloading would drop it.
    const { peekPayments, peekRefunds } = await import("@/features/payments/api/service");
    const paid =
      peekPayments()
        .filter((p) => p.order_id === orderId && p.status === "PAID")
        .reduce((s, p) => s + p.amount_paise, 0) -
      peekRefunds()
        .filter((r) => r.order_id === orderId && r.status === "REFUNDED")
        .reduce((s, r) => s + r.amount_paise, 0);
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

/**
 * Single shared rule deriving an order's kitchen step from ALL non-voided
 * tickets (Toast/Lightspeed/Odoo aggregation): an order is ready only when
 * every item is ready. Used by live sync AND load backfill alike, so the
 * list, detail, terminal and board can never disagree.
 */
export function deriveKitchenTarget(tickets: { status: KOTStatus }[]): OrderStatus | null {
  const active = tickets.filter((k) => k.status !== "CANCELLED");
  if (active.length === 0) return null;
  if (active.every((k) => k.status === "SERVED")) return "SERVED";
  if (active.every((k) => k.status === "READY" || k.status === "SERVED")) return "READY";
  if (active.some((k) => k.status === "PREPARING" || k.status === "READY")) return "PREPARING";
  return "IN_KITCHEN";
}

const KITCHEN_CHAIN: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"];

const STEP_EVENT_FOR: Record<OrderStatus, any> = {
  DRAFT: "KITCHEN_TICKET_UPDATED",
  CONFIRMED: "KITCHEN_TICKET_UPDATED",
  IN_KITCHEN: "KITCHEN_TICKET_UPDATED",
  PREPARING: "KITCHEN_STARTED",
  READY: "ORDER_READY",
  SERVED: "ORDER_SERVED",
  COMPLETED: "ORDER_COMPLETED",
  CANCELLED: "ORDER_CANCELLED",
};

/**
 * Walk idx forward along KITCHEN_CHAIN; returns true when anything moved.
 * Silent mode writes status without events — used only by load backfill:
 * reconciliation narrates nothing, so a catch-up never fabricates audit
 * history with fresh timestamps.
 */
async function walkForward(
  idx: number,
  target: OrderStatus,
  opts?: { silent?: boolean },
): Promise<boolean> {
  let cur = KITCHEN_CHAIN.indexOf(mockOrders[idx].status);
  const goal = KITCHEN_CHAIN.indexOf(target);
  if (cur === -1 || goal === -1 || cur >= goal) return false;
  while (cur < goal) {
    const next = KITCHEN_CHAIN[cur + 1];
    if (opts?.silent) {
      const now = new Date().toISOString();
      mockOrders[idx] = {
        ...mockOrders[idx],
        status: next,
        updated_at: now,
        version: mockOrders[idx].version + 1,
      };
    } else {
      await transitionOrder(idx, next, { event_type: STEP_EVENT_FOR[next] });
    }
    cur++;
  }
  return true;
}

/**
 * Self-heal on load: orders frozen mid-lifecycle (e.g. served before the
 * propagation fix) walk forward to their derived step, change-only and
 * SILENT — steady state writes nothing and emits nothing, so reloads never
 * fabricate audit history.
 */
async function backfillOrderKitchenStates(): Promise<void> {
  loadOrders();
  const { readTicketsSnapshot } = await import("@/features/kitchen/api/service");
  const tickets = readTicketsSnapshot();
  let dirty = false;
  for (let idx = 0; idx < mockOrders.length; idx++) {
    const o = mockOrders[idx];
    if (o.deleted_at) continue;
    if (!["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"].includes(o.status)) continue;
    const target = deriveKitchenTarget(tickets.filter((t) => t.order_id === o.id));
    if (!target) continue;
    if (await walkForward(idx, target, { silent: true })) dirty = true;
  }
  if (dirty) saveOrders();
}

/**
 * Advance ORDER.status from kitchen progress (advance-only, never regresses).
 * Called by the kitchen commands after accept / prepare / line-ready / serve.
 * Each step walked emits its order-level event (ORDER_READY / ORDER_SERVED),
 * so the kitchen ticket transitions stay ticket-scoped and never double-emit.
 */
export async function refreshOrderKitchenState(orderId: string): Promise<void> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    loadOrders();
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) return;
    const order = mockOrders[idx];
    if (!["CONFIRMED", "IN_KITCHEN", "PREPARING", "READY", "SERVED"].includes(order.status)) return;
    // peek (memory, no reload): this runs inside kitchen mutations with
    // un-persisted ticket writes — reloading here would revert them and the
    // later save would persist the revert. Sibling-tab staleness is bounded
    // (advance-only; backfill heals on read).
    const { peekTickets } = await import("@/features/kitchen/api/service");
    const target = deriveKitchenTarget(peekTickets().filter((t) => t.order_id === orderId));
    if (!target) return;
    if (await walkForward(idx, target)) saveOrders();
  } finally {
    release();
  }
}

/**
 * Explicit completion: zero balance → COMPLETED (ORDER_COMPLETED).
 * Cash settlement marks every open KOT served first (a settled bill means the
 * food is handed over) — served outside the order lock, then derivation lands
 * the order on SERVED honestly. Normal path needs SERVED; force path completes
 * from any non-terminal state with a mandatory reason, the event recording
 * forced/from_state. Settle-first always holds: a balance due blocks both paths.
 */
export async function completeOrder(
  orderId: string,
  params?: { by?: string; reason?: string; force?: boolean },
  by?: string,
): Promise<OrderWithDerived> {
  // Serve open tickets BEFORE the order lock: serveOpenTickets takes kot locks
  // then the order lock via derivation — nesting it inside would deadlock.
  // Read-only guards run first so a blocked completion serves nothing.
  const { paidTotalForOrder } = await import("@/features/payments/api/service");
  loadOrders();
  const pre = mockOrders.find((o) => o.id === orderId && !o.deleted_at);
  if (!pre) throw new Error("Order not found");
  if (pre.status === "COMPLETED" || pre.status === "CANCELLED") {
    throw new Error(`Order is already ${pre.status.toLowerCase()}`);
  }
  const preBalance = Math.max(0, pre.grand_total_paise - (await paidTotalForOrder(orderId)));
  if (preBalance > 0) {
    throw new Error(`Collect the remaining ₹${(preBalance / 100).toFixed(2)} before completing`);
  }
  const { serveOpenTickets } = await import("@/features/kitchen/api/service");
  await serveOpenTickets(orderId, { by: params?.by ?? by });
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    loadOrders();
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const order = mockOrders[idx];
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error(`Order is already ${order.status.toLowerCase()}`);
    }
    const actor = params?.by ?? by ?? "staff";
    const forced = !!params?.force && order.status !== "SERVED";
    if (!forced && order.status !== "SERVED") {
      throw new Error(
        `Only served orders can be completed (order is ${order.status.toLowerCase()}) — or force-complete with a reason`,
      );
    }
    if (forced && !params?.reason?.trim()) {
      throw new Error("A reason is required to force-complete an order");
    }
    const { paidTotalForOrder } = await import("@/features/payments/api/service");
    const balance = Math.max(0, order.grand_total_paise - (await paidTotalForOrder(orderId)));
    if (balance > 0) {
      throw new Error(`Collect the remaining ₹${(balance / 100).toFixed(2)} before completing`);
    }
    await transitionOrder(idx, "COMPLETED", {
      actor_id: actor,
      event_type: "ORDER_COMPLETED",
      reason_text: forced ? params?.reason?.trim() : undefined,
      metadata: forced ? { forced: true, from_state: order.status } : undefined,
      force: forced || undefined,
    });
    saveOrders();
    // Auto-print bill (+ takeaway token) on settle. Dynamic import avoids an
    // orders <-> print-studio cycle; print failure never fails completion.
    const { maybeAutoPrintBill } = await import("@/features/print-studio/api/service");
    await maybeAutoPrintBill(orderId, actor);
    return enrichOrder(mockOrders[idx]);
  } finally {
    release();
  }
}

/**
 * @dev-only Demo seed: builds 10 orders across statuses using real commands.
 * Expects a fresh module state — the dev-seed page clears the order/KOT/
 * payment localStorage keys and reloads before calling this. Never link from
 * nav; the temporary route is deleted before merge.
 */
export async function seedDemoOrders(log: (msg: string) => void = () => {}): Promise<string[]> {
  const kitchen = await import("@/features/kitchen/api/service");
  const payments = await import("@/features/payments/api/service");
  const created: string[] = [];
  const step = async (label: string, fn: () => Promise<unknown>) => {
    await fn();
    log(label);
  };

  // Seat one group so dine-in seeds pass the occupancy guard.
  const group = await seatOccupancy({ table_id: "tbl_001", seats: 2, created_by: "seed" });
  log(`Seated demo group on TBL 101`);

  // 1. CONFIRMED dine-in, unfired lines.
  const o1 = await createOrder({
    channel: "dine_in",
    table_id: "tbl_001",
    occupancy_group_id: group.id,
  });
  await addOrderItem(o1.id, { menu_item_id: "mi_001", variant_id: "mv_002", qty: 1 });
  await addOrderItem(o1.id, { menu_item_id: "mi_002", qty: 2 });
  created.push(o1.id);
  log(`1 CONFIRMED dine-in, 2 unfired lines`);

  // 2. IN_KITCHEN dine-in, 1 KOT.
  const o2 = await createOrder({
    channel: "dine_in",
    table_id: "tbl_001",
    occupancy_group_id: group.id,
  });
  await kitchen.addAndFireItem(o2.id, { menu_item_id: "mi_001", variant_id: "mv_001", qty: 2 });
  created.push(o2.id);
  log(`2 IN_KITCHEN dine-in, 1 KOT`);

  // 3. PREPARING delivery.
  const o3 = await createOrder({
    channel: "delivery",
    customer_name: "Seed Meera",
    customer_phone: "9000000003",
  });
  await kitchen.addAndFireItem(o3.id, { menu_item_id: "mi_003", qty: 3 });
  const k3 = (await kitchen.getKOTsByOrder(o3.id))[0];
  await kitchen.acceptKOT(k3.id, "seed");
  await kitchen.startPreparingKOT(k3.id, "seed");
  await walkOrderTo(o3.id, "PREPARING");
  created.push(o3.id);
  log(`3 PREPARING delivery`);

  // 4. READY takeaway.
  const o4 = await createOrder({
    channel: "takeaway",
    customer_name: "Seed Arjun",
    customer_phone: "9000000004",
  });
  await kitchen.addAndFireItem(o4.id, { menu_item_id: "mi_003", qty: 2 });
  const k4 = (await kitchen.getKOTsByOrder(o4.id))[0];
  await kitchen.acceptKOT(k4.id, "seed");
  await kitchen.startPreparingKOT(k4.id, "seed");
  await kitchen.markLineReady(k4.id, k4.lines[0].id, "seed");
  await walkOrderTo(o4.id, "READY");
  created.push(o4.id);
  log(`4 READY takeaway`);

  // 5. SERVED zomato.
  const o5 = await createOrder({
    channel: "zomato",
    customer_name: "Seed Zoya",
    customer_phone: "9000000005",
    external_ref: "ZOM-SEED-5",
  });
  await kitchen.addAndFireItem(o5.id, { menu_item_id: "mi_002", qty: 2 });
  const k5 = (await kitchen.getKOTsByOrder(o5.id))[0];
  await kitchen.acceptKOT(k5.id, "seed");
  await kitchen.startPreparingKOT(k5.id, "seed");
  await kitchen.markLineReady(k5.id, k5.lines[0].id, "seed");
  await kitchen.serveKOT(k5.id, "seed");
  await walkOrderTo(o5.id, "SERVED");
  created.push(o5.id);
  log(`5 SERVED zomato`);

  // 6. COMPLETED delivery, paid in full (cash + UPI combined).
  const o6 = await createOrder({
    channel: "delivery",
    customer_name: "Seed Kabir",
    customer_phone: "9000000006",
  });
  await kitchen.addAndFireItem(o6.id, { menu_item_id: "mi_003", qty: 2 });
  const b6 = (await getOrderWithBilling(o6.id))!;
  const half = Math.floor(b6.balance_paise / 2);
  await payments.collectPayment({
    order_id: o6.id,
    method: "cash",
    amount_paise: half,
    tendered_paise: half,
  });
  await payments.collectPayment({
    order_id: o6.id,
    method: "upi",
    amount_paise: b6.balance_paise - half,
  });
  await walkOrderTo(o6.id, "COMPLETED");
  created.push(o6.id);
  log(`6 COMPLETED delivery, paid cash+UPI`);

  // 7. PARTIAL dine-in.
  const o7 = await createOrder({
    channel: "dine_in",
    table_id: "tbl_001",
    occupancy_group_id: group.id,
  });
  await kitchen.addAndFireItem(o7.id, { menu_item_id: "mi_001", variant_id: "mv_002", qty: 2 });
  const b7 = (await getOrderWithBilling(o7.id))!;
  await payments.collectPayment({
    order_id: o7.id,
    method: "upi",
    amount_paise: Math.floor(b7.balance_paise / 2),
  });
  created.push(o7.id);
  log(`7 PARTIAL dine-in, half paid by UPI`);

  // 8. CANCELLED takeaway.
  const o8 = await createOrder({
    channel: "takeaway",
    customer_name: "Seed Tara",
    customer_phone: "9000000008",
  });
  await addOrderItem(o8.id, { menu_item_id: "mi_001", variant_id: "mv_001", qty: 1 });
  await cancelOrder(o8.id, { reason: "Seed: customer walked out", by: "seed" });
  created.push(o8.id);
  log(`8 CANCELLED takeaway`);

  // 9. IN_KITCHEN swiggy with a partial line void.
  const o9 = await createOrder({
    channel: "swiggy",
    customer_name: "Seed Vihaan",
    customer_phone: "9000000009",
    external_ref: "SWG-SEED-9",
  });
  await kitchen.addAndFireItem(o9.id, { menu_item_id: "mi_003", qty: 3 });
  const k9 = (await kitchen.getKOTsByOrder(o9.id))[0];
  await kitchen.voidKOTLine(k9.id, k9.lines[0].id, {
    qty: 1,
    reason: "Seed: one portion dropped",
    by: "seed",
  });
  created.push(o9.id);
  log(`9 IN_KITCHEN swiggy, 1 of 3 voided`);

  // 10. IN_KITCHEN dine-in, 10% discount + equal split, one share paid.
  const o10 = await createOrder({
    channel: "dine_in",
    table_id: "tbl_001",
    occupancy_group_id: group.id,
  });
  await kitchen.addAndFireItem(o10.id, { menu_item_id: "mi_001", variant_id: "mv_002", qty: 2 });
  await kitchen.addAndFireItem(o10.id, { menu_item_id: "mi_002", qty: 2 });
  await setDiscount(o10.id, { percent: 10, reason: "Seed: festival offer", by: "seed" });
  const withSplit = await computeSplits(o10.id, { mode: "equal", count: 2 });
  const first = withSplit.split!.partitions[0];
  await payments.collectPayment({
    order_id: o10.id,
    method: "cash",
    amount_paise: first.amount_paise,
    partition_label: first.label,
  });
  created.push(o10.id);
  log(`10 IN_KITCHEN dine-in, discounted + split, one share paid`);

  return created;
}

/** Walk an order along the legal transition chain (dev seed only). */
async function walkOrderTo(orderId: string, to: OrderStatus): Promise<void> {
  const chain: OrderStatus[] = [
    "CONFIRMED",
    "IN_KITCHEN",
    "PREPARING",
    "READY",
    "SERVED",
    "COMPLETED",
  ];
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    const fromIdx = chain.indexOf(mockOrders[idx].status);
    const toIdx = chain.indexOf(to);
    if (fromIdx === -1 || toIdx === -1 || toIdx < fromIdx) {
      throw new Error(`Cannot walk order to ${to}`);
    }
    for (let i = fromIdx; i < toIdx; i++) {
      await transitionOrder(idx, chain[i + 1], { actor_id: "seed" });
    }
    saveOrders();
  } finally {
    release();
  }
}

import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import { toPaise } from "@/lib/money";
import { getMenuItemById, getModifiers } from "@/features/menu/api/service";
import { getTableById } from "@/features/table/api/service";
import type {
  AddItemInput,
  CreateOrderInput,
  OrderFilters,
  OrderItemSnapshot,
  OrderStatus,
  OrderWithDerived,
  RestaurantOrder,
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

function loadOrders(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.orders)) mockOrders = parsed.orders;
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

function recomputeTotals(order: RestaurantOrder): RestaurantOrder {
  const subtotal = order.items.reduce((s, i) => s + i.line_total_paise, 0);
  const tax = order.items.reduce((s, i) => s + i.line_tax_paise, 0);
  return { ...order, subtotal_paise: subtotal, tax_paise: tax, total_paise: subtotal + tax };
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
      status: "DRAFT",
      items: [],
      subtotal_paise: 0,
      tax_paise: 0,
      total_paise: 0,
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
      to_state: "DRAFT",
      actor_id: order.created_by,
      metadata: { channel: order.channel, order_number: order.order_number },
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
    if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
      throw new Error(`Cannot add items to an order in ${order.status}. Fire a new KOT from the kitchen flow.`);
    }

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

export async function confirmOrder(orderId: string, by?: string): Promise<OrderWithDerived> {
  const release = await entityMutex.acquire(`order-${orderId}`);
  try {
    await delay(300);
    const idx = mockOrders.findIndex((o) => o.id === orderId && !o.deleted_at);
    if (idx === -1) throw new Error("Order not found");
    if (mockOrders[idx].items.length === 0) throw new Error("Cannot confirm an empty order");
    await transitionOrder(idx, "CONFIRMED", { actor_id: by ?? "staff", event_type: "ORDER_CONFIRMED" });
    saveOrders();
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

export { canTransitionOrder };

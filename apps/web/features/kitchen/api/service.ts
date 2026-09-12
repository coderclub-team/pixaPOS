import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { recordWasteForCancelledOrder } from "@/features/inventory/api/service";
import { entityMutex } from "@/lib/mutex";
import {
  addOrderItem,
  assertTableOccupied,
  confirmOrder,
  getOrderById,
  markLinesFired,
  setOrderLineQty,
} from "@/features/orders/api/service";
import type { AddItemInput } from "@/features/orders/api/types";
import type {
  KitchenTicket,
  KitchenTicketWithDerived,
  KOTFilters,
  KOTStatus,
} from "./types";

const KOT_STORAGE_KEY = "pixaKOTs";

let mockTickets: KitchenTicket[] = [];

function saveTickets() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KOT_STORAGE_KEY, JSON.stringify({ tickets: mockTickets }));
    } catch {}
  }
}

function loadTickets(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(KOT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.tickets)) mockTickets = parsed.tickets;
      }
    } catch {}
  }
}
loadTickets();

/** Explicit KOT machine (docs/workflows.md §3). Kitchen ≠ order state. */
const KOT_TRANSITIONS: Record<KOTStatus, KOTStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

function enrichTicket(t: KitchenTicket): KitchenTicketWithDerived {
  return {
    ...t,
    pending_lines: t.lines.filter((l) => l.status === "PENDING" || l.status === "PREPARING").length,
    ready_lines: t.lines.filter((l) => l.status === "READY").length,
    age_minutes: Math.max(0, Math.round((Date.now() - new Date(t.fired_at).getTime()) / 60000)),
  };
}

async function transitionTicket(
  idx: number,
  to: KOTStatus,
  ctx: { actor_id?: string; reason_text?: string; event_type?: any },
): Promise<void> {
  const current = mockTickets[idx];
  const from = current.status;
  if (from === to) return;
  if (!KOT_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal KOT transition ${from} → ${to}`);
  }
  mockTickets[idx] = {
    ...current,
    status: to,
    updated_at: new Date().toISOString(),
    version: current.version + 1,
  };
  await recordEvent({
    outlet_id: current.outlet_id,
    entity_type: "ORDER",
    entity_id: current.order_id,
    event_type: ctx.event_type ?? "KITCHEN_TICKET_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: ctx.actor_id,
    reason_text: ctx.reason_text,
    metadata: { kot_id: current.id },
  });
}

export async function getKitchenTickets(filters?: KOTFilters): Promise<KitchenTicketWithDerived[]> {
  await delay(300);
  let r = [...mockTickets];
  if (filters?.outlet_id) r = r.filter((t) => t.outlet_id === filters.outlet_id);
  if (filters?.status) r = r.filter((t) => t.status === filters.status);
  return r.sort((a, b) => a.fired_at.localeCompare(b.fired_at)).map(enrichTicket);
}

export async function getKOTsByOrder(orderId: string): Promise<KitchenTicketWithDerived[]> {
  await delay(200);
  return mockTickets
    .filter((t) => t.order_id === orderId)
    .sort((a, b) => a.kot_number - b.kot_number)
    .map(enrichTicket);
}

export async function getTicketById(id: string): Promise<KitchenTicketWithDerived | null> {
  await delay(200);
  const t = mockTickets.find((t) => t.id === id);
  return t ? enrichTicket(t) : null;
}

/**
 * Fire the order's unfired draft lines to the kitchen. Freezes those lines
 * into a new immutable KOT; the order keeps a fresh virtual draft for the
 * next round — 1 order → N KOTs.
 */
export async function fireKOT(orderId: string, by?: string): Promise<KitchenTicketWithDerived> {
  const release = await entityMutex.acquire(`kot-order-${orderId}`);
  try {
    await delay(400);
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "DRAFT") throw new Error("Confirm the order before firing to the kitchen");
    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new Error(`Cannot fire KOT for a ${order.status.toLowerCase()} order`);
    }
    const draftLines = order.items.filter((i) => !i.kot_id);
    if (draftLines.length === 0) throw new Error("No new items to fire");

    const now = new Date().toISOString();
    const kotNumber =
      mockTickets.filter((t) => t.order_id === orderId).length + 1;
    const ticket: KitchenTicket = {
      id: `kot_${Date.now().toString(36)}`,
      outlet_id: order.outlet_id,
      order_id: order.id,
      order_number_snapshot: order.order_number,
      table_number_snapshot: order.table_number_snapshot,
      channel: order.channel,
      kot_number: kotNumber,
      status: "NEW",
      lines: draftLines.map((l) => ({
        id: `kotl_${Math.random().toString(36).slice(2, 8)}`,
        order_line_id: l.id,
        item_name_snapshot: l.item_name_snapshot,
        variant_name_snapshot: l.variant_name_snapshot,
        modifiers_snapshot: l.modifiers.map((m) => m.name_snapshot),
        instructions: l.instructions,
        qty: l.qty,
        voided_qty: 0,
        status: "PENDING",
      })),
      voids: [],
      fired_by: by ?? "staff",
      fired_at: now,
      updated_at: now,
      version: 1,
    };
    mockTickets.push(ticket);
    await markLinesFired(
      orderId,
      draftLines.map((l, i) => ({
        line_id: l.id,
        kot_id: ticket.id,
        kot_line_id: ticket.lines[i].id,
      })),
    );
    saveTickets();
    await recordEvent({
      outlet_id: order.outlet_id,
      entity_type: "ORDER",
      entity_id: order.id,
      event_type: "ORDER_SENT_TO_KITCHEN",
      to_state: "IN_KITCHEN",
      actor_id: by ?? "staff",
      metadata: { kot_id: ticket.id, kot_number: kotNumber, lines: ticket.lines.length },
    });
    return enrichTicket(ticket);
  } finally {
    release();
  }
}

export async function acceptKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    await transitionTicket(idx, "ACCEPTED", { actor_id: by ?? "kitchen", event_type: "KITCHEN_STARTED" });
  });
}

export async function startPreparingKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    await transitionTicket(idx, "PREPARING", { actor_id: by ?? "kitchen" });
    mockTickets[idx] = {
      ...mockTickets[idx],
      lines: mockTickets[idx].lines.map((l) =>
        l.status === "PENDING" ? { ...l, status: "PREPARING" as const } : l,
      ),
    };
  });
}

export async function markLineReady(id: string, lineId: string, by?: string): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    if (t.lines[li].status === "VOIDED") throw new Error("Line is voided");
    const lines = [...t.lines];
    lines[li] = { ...lines[li], status: "READY" as const };
    mockTickets[idx] = { ...t, lines, updated_at: new Date().toISOString(), version: t.version + 1 };
    await recordEvent({
      outlet_id: t.outlet_id,
      entity_type: "ORDER",
      entity_id: t.order_id,
      event_type: "KITCHEN_ITEM_READY",
      actor_id: by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    if (lines.every((l) => l.status === "READY" || l.status === "VOIDED" || l.status === "SERVED")) {
      await transitionTicket(idx, "READY", { actor_id: by ?? "kitchen", event_type: "ORDER_READY" });
    }
  });
}

export async function serveKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status !== "READY") throw new Error("Only READY tickets can be served");
    mockTickets[idx] = {
      ...t,
      lines: t.lines.map((l) => (l.status === "READY" ? { ...l, status: "SERVED" as const } : l)),
    };
    await transitionTicket(idx, "SERVED", { actor_id: by ?? "staff", event_type: "ORDER_SERVED" });
  });
}

async function mutateTicket(
  id: string,
  fn: (idx: number) => Promise<void>,
): Promise<KitchenTicketWithDerived> {
  const release = await entityMutex.acquire(`kot-${id}`);
  try {
    await delay(300);
    const idx = mockTickets.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("KOT not found");
    await fn(idx);
    saveTickets();
    return enrichTicket(mockTickets[idx]);
  } finally {
    release();
  }
}

/**
 * Void a whole fired KOT. Recorded as a deletion on the KOT (red-marked,
 * never hard-deleted); kitchen-consumed lines flow to waste via the existing
 * recordWasteForCancelledOrder caller contract.
 */
export async function voidKOT(
  id: string,
  params: { reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (!params.reason?.trim()) throw new Error("A reason is required to void a KOT");
    if (t.status === "SERVED") throw new Error("A served KOT cannot be voided");
    if (t.status === "CANCELLED") return;
    const orderForLock = await getOrderById(t.order_id);
    if (orderForLock) await assertTableOccupied(orderForLock);
    const now = new Date().toISOString();
    const activeLines = t.lines.filter((l) => l.status !== "VOIDED");
    const consumed = activeLines.filter((l) => l.status === "PREPARING" || l.status === "READY");
    mockTickets[idx] = {
      ...t,
      lines: t.lines.map((l) =>
        l.status === "VOIDED" ? l : { ...l, status: "VOIDED" as const, voided_qty: l.qty },
      ),
      voids: [
        ...t.voids,
        {
          id: `void_${Date.now().toString(36)}`,
          qty: activeLines.reduce((s, l) => s + (l.qty - l.voided_qty), 0),
          reason: params.reason,
          voided_by: params.by ?? "staff",
          created_at: now,
        },
      ],
    };
    if (consumed.length > 0) {
      const order = await getOrderById(t.order_id);
      await recordWasteForCancelledOrder({
        order_id: t.order_id,
        order_number: order?.order_number,
        created_by: params.by ?? "staff",
        lines: consumed.map((l) => {
          const ol = order?.items.find((i) => i.id === l.order_line_id);
          return {
            recipe_id: ol?.recipe_id_snapshot ?? "",
            variant_id: ol?.variant_id,
            servings: l.qty - l.voided_qty,
          };
        }).filter((l) => l.recipe_id),
      });
    }
    await transitionTicket(idx, "CANCELLED", {
      actor_id: params.by ?? "staff",
      reason_text: params.reason,
      event_type: "KOT_VOIDED",
    });
  });
}

/** Partial or full void of one KOT line, with mandatory reason. */
export async function voidKOTLine(
  id: string,
  lineId: string,
  params: { qty?: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (!params.reason?.trim()) throw new Error("A reason is required to void an item");
    if (t.status === "SERVED" || t.status === "CANCELLED") {
      throw new Error(`Cannot void a line on a ${t.status.toLowerCase()} KOT`);
    }
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    if (line.status === "VOIDED") return;
    if (line.status === "SERVED") throw new Error("A served line cannot be voided");
    const orderForLock = await getOrderById(t.order_id);
    if (orderForLock) await assertTableOccupied(orderForLock);
    const qty = params.qty ?? line.qty - line.voided_qty;
    const remaining = line.qty - line.voided_qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > remaining) {
      throw new Error(`Void qty must be between 1 and ${remaining}`);
    }
    const now = new Date().toISOString();
    const lines = [...t.lines];
    lines[li] = {
      ...line,
      voided_qty: line.voided_qty + qty,
      status: line.voided_qty + qty >= line.qty ? ("VOIDED" as const) : line.status,
    };
    mockTickets[idx] = {
      ...t,
      lines,
      voids: [
        ...t.voids,
        {
          id: `void_${Date.now().toString(36)}`,
          kot_line_id: lineId,
          qty,
          reason: params.reason,
          voided_by: params.by ?? "staff",
          created_at: now,
        },
      ],
      updated_at: now,
      version: t.version + 1,
    };
    if (line.status === "PREPARING" || line.status === "READY") {
      const order = await getOrderById(t.order_id);
      const ol = order?.items.find((i) => i.id === line.order_line_id);
      if (ol?.recipe_id_snapshot) {
        await recordWasteForCancelledOrder({
          order_id: t.order_id,
          order_number: order?.order_number,
          created_by: params.by ?? "staff",
          lines: [{ recipe_id: ol.recipe_id_snapshot, variant_id: ol.variant_id, servings: qty }],
        });
      }
    }
    await recordEvent({
      outlet_id: t.outlet_id,
      entity_type: "ORDER",
      entity_id: t.order_id,
      event_type: "KOT_LINE_VOIDED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason,
      metadata: { kot_id: id, kot_line_id: lineId, qty },
    });
  });
}

/**
 * Terminal fast path: confirm-if-DRAFT, add the item, fire immediately.
 * No draft step — the item lands straight on a new KOT.
 */
export async function addAndFireItem(
  orderId: string,
  input: AddItemInput,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "DRAFT") {
    await confirmOrder(orderId, by);
  }
  await addOrderItem(orderId, input);
  return fireKOT(orderId, by);
}

/**
 * Increase a fired KOT line qty (kitchen makes more). Bumps both the KOT
 * line and the order line so the bill stays in sync. Decreases go through
 * voidKOTLine with a reason so cancellations are always recorded.
 */
export async function increaseKOTLineQty(
  id: string,
  lineId: string,
  params: { extra: number; by?: string },
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status === "SERVED" || t.status === "CANCELLED") {
      throw new Error(`Cannot change a line on a ${t.status.toLowerCase()} KOT`);
    }
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    if (line.status === "VOIDED" || line.status === "SERVED" || line.status === "READY") {
      throw new Error(`Cannot add qty to a ${line.status.toLowerCase()} line`);
    }
    if (!Number.isInteger(params.extra) || params.extra < 1 || params.extra > 50) {
      throw new Error("Extra qty must be between 1 and 50");
    }
    const orderForLock = await getOrderById(t.order_id);
    if (orderForLock) await assertTableOccupied(orderForLock);
    await setOrderLineQty(t.order_id, line.order_line_id, line.qty + params.extra);
    const lines = [...t.lines];
    lines[li] = { ...line, qty: line.qty + params.extra };
    mockTickets[idx] = {
      ...t,
      lines,
      updated_at: new Date().toISOString(),
      version: t.version + 1,
    };
    await recordEvent({
      outlet_id: t.outlet_id,
      entity_type: "ORDER",
      entity_id: t.order_id,
      event_type: "KOT_LINE_QTY_ADDED",
      actor_id: params.by ?? "staff",
      metadata: { kot_id: id, kot_line_id: lineId, extra: params.extra },
    });
  });
}

import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { recordWasteForCancelledOrder } from "@/features/inventory/api/service";
import { entityMutex } from "@/lib/mutex";
import {
  addOrderItem,
  getOrderById,
  markLinesFired,
  refreshOrderKitchenState,
  setOrderLineQty,
} from "@/features/orders/api/service";
import type { AddItemInput } from "@/features/orders/api/types";
import type {
  KitchenTicket,
  KitchenTicketWithDerived,
  KOTFilters,
  KOTLineStatus,
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
        if (Array.isArray(parsed?.tickets)) {
          // Backfill return fields for tickets written before returns existed.
          mockTickets = parsed.tickets.map((t: KitchenTicket) => ({
            ...t,
            returns: t.returns ?? [],
            lines: (t.lines ?? []).map((l) => ({ ...l, returned_qty: l.returned_qty ?? 0 })),
          }));
        }
      }
    } catch {}
  }
}
loadTickets();

/**
 * Synchronous shared-source snapshot for cross-domain aggregation (order
 * status backfill). Reloads from localStorage first — no delay, no lock;
 * callers hold their own locks.
 */
export function readTicketsSnapshot(): KitchenTicketWithDerived[] {
  loadTickets();
  return [...mockTickets].map(enrichTicket);
}

/**
 * In-memory read WITHOUT reload — for use inside mutations that already
 * hold fresh state. Reloading mid-mutation (before save) would revert the
 * in-flight change and the subsequent save would persist the revert.
 */
export function peekTickets(): KitchenTicketWithDerived[] {
  return [...mockTickets].map(enrichTicket);
}

/** Explicit KOT machine (docs/workflows.md §3). Kitchen ≠ order state. */
const KOT_TRANSITIONS: Record<KOTStatus, KOTStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

/**
 * Per-line machine (docs/workflows.md §3). Items walk
 * PENDING → ACCEPTED → PREPARING → READY → SERVED — READY is reachable only
 * from PREPARING, so an order is never marked ready without preparation.
 * ACCEPTED is acknowledgment, not a tollbooth: PENDING → PREPARING stays
 * legal (bulk start, fast path). VOIDED is the audited exit from any
 * non-terminal line state.
 */
const KOT_LINE_TRANSITIONS: Record<KOTLineStatus, KOTLineStatus[]> = {
  PENDING: ["ACCEPTED", "PREPARING", "VOIDED"],
  ACCEPTED: ["PREPARING", "VOIDED"],
  PREPARING: ["READY", "VOIDED"],
  READY: ["SERVED", "VOIDED"],
  SERVED: [],
  VOIDED: [],
};

function assertLineTransition(from: KOTLineStatus, to: KOTLineStatus, what: string): void {
  if (from === to) return;
  if (!KOT_LINE_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal KOT line transition ${from} → ${to} (${what})`);
  }
}

function enrichTicket(t: KitchenTicket): KitchenTicketWithDerived {
  return {
    ...t,
    pending_lines: t.lines.filter(
      (l) => l.status === "PENDING" || l.status === "ACCEPTED" || l.status === "PREPARING",
    ).length,
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

/**
 * Fire-and-forget fan-out to the KDS live feed (Neon function). Called after
 * every KOT mutation so wallboards subscribed over SSE refresh instantly.
 * Never throws: offline or misconfigured feed must not break kitchen work —
 * the 5s poll and cross-tab sync remain the fallback.
 */
export function publishKds(kind: string, payload: Record<string, unknown>): void {
  try {
    const base = process.env.NEXT_PUBLIC_KDS_FEED_URL;
    const secret = process.env.NEXT_PUBLIC_KDS_FEED_SECRET;
    if (!base || !secret || typeof fetch === "undefined") return;
    void fetch(`${base.replace(/\/$/, "")}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never break the mutation path */
  }
}

function publishTicket(t: KitchenTicket, extra?: Record<string, unknown>): void {
  publishKds("kot", {
    kot_id: t.id,
    order_id: t.order_id,
    status: t.status,
    kot_number: t.kot_number,
    ...extra,
  });
}

export async function getKitchenTickets(filters?: KOTFilters): Promise<KitchenTicketWithDerived[]> {
  await delay(300);
  loadTickets(); // localStorage is the shared source — reload so tabs/displays agree
  let r = [...mockTickets];
  if (filters?.outlet_id) r = r.filter((t) => t.outlet_id === filters.outlet_id);
  if (filters?.status) r = r.filter((t) => t.status === filters.status);
  return r.sort((a, b) => a.fired_at.localeCompare(b.fired_at)).map(enrichTicket);
}

export async function getKOTsByOrder(orderId: string): Promise<KitchenTicketWithDerived[]> {
  await delay(200);
  loadTickets();
  return mockTickets
    .filter((t) => t.order_id === orderId)
    .sort((a, b) => a.kot_number - b.kot_number)
    .map(enrichTicket);
}

export async function getTicketById(id: string): Promise<KitchenTicketWithDerived | null> {
  await delay(200);
  loadTickets();
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
    loadTickets(); // fresh base for numbering — no writes held yet this frame
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");
    // DRAFT carts fire directly (first fire walks DRAFT → IN_KITCHEN via
    // markLinesFired) — no CONFIRMED step in new flows.
    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new Error(`Cannot fire KOT for a ${order.status.toLowerCase()} order`);
    }
    const draftLines = order.items.filter((i) => !i.kot_id);
    if (draftLines.length === 0) throw new Error("No new items to fire");

    const now = new Date().toISOString();
    const kotNumber = mockTickets.filter((t) => t.order_id === orderId).length + 1;
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
        returned_qty: 0,
        status: "PENDING",
      })),
      voids: [],
      returns: [],
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
    publishTicket(ticket, { lines: ticket.lines.length });
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
    const t = mockTickets[idx];
    if (t.status === "ACCEPTED") return;
    if (t.status !== "NEW") {
      throw new Error(`Only NEW tickets can be accepted (KOT is ${t.status.toLowerCase()})`);
    }
    await transitionTicket(idx, "ACCEPTED", {
      actor_id: by ?? "kitchen",
      event_type: "KITCHEN_STARTED",
    });
    await refreshOrderKitchenState(t.order_id);
  });
}

export async function startPreparingKOT(
  id: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status === "PREPARING") return;
    if (t.status !== "ACCEPTED") {
      throw new Error(
        t.status === "NEW"
          ? "Accept the KOT before preparing"
          : `Cannot prepare a ${t.status.toLowerCase()} KOT`,
      );
    }
    await transitionTicket(idx, "PREPARING", { actor_id: by ?? "kitchen" });
    mockTickets[idx] = {
      ...mockTickets[idx],
      lines: mockTickets[idx].lines.map((l) =>
        l.status === "PENDING" || l.status === "ACCEPTED"
          ? { ...l, status: "PREPARING" as const }
          : l,
      ),
    };
    await refreshOrderKitchenState(t.order_id);
  });
}

/**
 * Accept one item (multi-item KOTs acknowledge line by line). The ticket
 * follows its items: the first accepted line moves a NEW ticket to ACCEPTED
 * through the legal transition — never a skip.
 */
export async function acceptKOTLine(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status === "SERVED" || t.status === "CANCELLED") {
      throw new Error(`Cannot accept an item on a ${t.status.toLowerCase()} KOT`);
    }
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    if (line.status === "ACCEPTED") return;
    if (line.status !== "PENDING") {
      throw new Error(`Only pending items can be accepted (item is ${line.status.toLowerCase()})`);
    }
    assertLineTransition(line.status, "ACCEPTED", line.item_name_snapshot);
    const lines = [...t.lines];
    lines[li] = { ...line, status: "ACCEPTED" as const };
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
      event_type: "KITCHEN_TICKET_UPDATED",
      from_state: "PENDING",
      to_state: "ACCEPTED",
      actor_id: by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    if (mockTickets[idx].status === "NEW") {
      await transitionTicket(idx, "ACCEPTED", {
        actor_id: by ?? "kitchen",
        event_type: "KITCHEN_STARTED",
      });
    }
    await refreshOrderKitchenState(t.order_id);
  });
}

/**
 * Start one item (multi-item KOTs prepare line by line after accept). The
 * ticket follows its items: the first started line moves an ACCEPTED ticket
 * to PREPARING through the legal transition — never a skip.
 */
export async function startPreparingKOTLine(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status === "NEW") throw new Error("Accept the KOT before starting items");
    if (t.status === "READY" || t.status === "SERVED" || t.status === "CANCELLED") {
      throw new Error(`Cannot start an item on a ${t.status.toLowerCase()} KOT`);
    }
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    if (line.status === "PREPARING") return;
    if (line.status === "VOIDED" || line.status === "SERVED" || line.status === "READY") {
      throw new Error(`Cannot start a ${line.status.toLowerCase()} item`);
    }
    assertLineTransition(line.status, "PREPARING", line.item_name_snapshot);
    const lines = [...t.lines];
    lines[li] = { ...line, status: "PREPARING" as const };
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
      event_type: "KITCHEN_TICKET_UPDATED",
      from_state: line.status,
      to_state: "PREPARING",
      actor_id: by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    if (mockTickets[idx].status === "ACCEPTED") {
      await transitionTicket(idx, "PREPARING", {
        actor_id: by ?? "kitchen",
        event_type: "KITCHEN_TICKET_UPDATED",
      });
    }
    await refreshOrderKitchenState(t.order_id);
  });
}

export async function markLineReady(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    if (line.status === "READY") return;
    if (line.status === "VOIDED" || line.status === "SERVED") {
      throw new Error(`A ${line.status.toLowerCase()} line cannot be marked ready`);
    }
    if (line.status !== "PREPARING") {
      throw new Error(`Start preparing "${line.item_name_snapshot}" before marking it ready`);
    }
    assertLineTransition(line.status, "READY", line.item_name_snapshot);
    const lines = [...t.lines];
    lines[li] = { ...lines[li], status: "READY" as const };
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
      event_type: "KITCHEN_ITEM_READY",
      actor_id: by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    if (
      lines.every((l) => l.status === "READY" || l.status === "VOIDED" || l.status === "SERVED")
    ) {
      // Walk the legal path — an ACCEPTED ticket passes through PREPARING
      // first, never jumps straight to READY.
      if (mockTickets[idx].status === "ACCEPTED") {
        await transitionTicket(idx, "PREPARING", {
          actor_id: by ?? "kitchen",
          event_type: "KITCHEN_TICKET_UPDATED",
        });
      }
      if (mockTickets[idx].status === "PREPARING") {
        await transitionTicket(idx, "READY", {
          actor_id: by ?? "kitchen",
          event_type: "KITCHEN_TICKET_UPDATED",
        });
      } else if (mockTickets[idx].status !== "READY") {
        throw new Error(`Cannot ready a ${mockTickets[idx].status.toLowerCase()} KOT`);
      }
    }
    // Order-level ORDER_READY is owned by refreshOrderKitchenState (no double emit).
    await refreshOrderKitchenState(t.order_id);
  });
}

export async function serveKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (t.status !== "READY") throw new Error("Only READY tickets can be served");
    const notReady = t.lines.filter(
      (l) => l.status === "PENDING" || l.status === "ACCEPTED" || l.status === "PREPARING",
    );
    if (notReady.length > 0) {
      throw new Error(
        `${notReady.length} item${notReady.length === 1 ? " is" : "s are"} not ready yet — ${notReady.map((l) => l.item_name_snapshot).join(", ")}`,
      );
    }
    mockTickets[idx] = {
      ...t,
      lines: t.lines.map((l) => (l.status === "READY" ? { ...l, status: "SERVED" as const } : l)),
    };
    // Ticket leg stays KITCHEN_TICKET_UPDATED; ORDER_SERVED is owned by
    // refreshOrderKitchenState when the whole order is served (no double emit).
    await transitionTicket(idx, "SERVED", { actor_id: by ?? "staff" });
    await refreshOrderKitchenState(t.order_id);
  });
}

/**
 * Completion serve: mark every open ticket of an order SERVED in one pass.
 * Used by completeOrder (cash settlement) — a settled bill means the food is
 * handed over, so lines must not linger as cooking on the KDS. Skips terminal
 * tickets and VOIDED lines. One KITCHEN_TICKET_UPDATED per ticket (authorized
 * step-skip, metadata records it); order-level derivation runs once at the end
 * while the order is still non-terminal, so it lands on SERVED honestly.
 */
export async function serveOpenTickets(orderId: string, params?: { by?: string }): Promise<number> {
  loadTickets();
  const openIds = mockTickets
    .filter((t) => t.order_id === orderId && t.status !== "SERVED" && t.status !== "CANCELLED")
    .map((t) => t.id);
  for (const id of openIds) {
    await mutateTicket(id, async (idx) => {
      const t = mockTickets[idx];
      if (t.status === "SERVED" || t.status === "CANCELLED") return;
      const from = t.status;
      const liveLines = t.lines.filter((l) => l.status !== "VOIDED");
      if (liveLines.length === 0) return;
      const now = new Date().toISOString();
      mockTickets[idx] = {
        ...t,
        status: "SERVED",
        lines: t.lines.map((l) =>
          l.status === "VOIDED" ? l : { ...l, status: "SERVED" as const },
        ),
        updated_at: now,
        version: t.version + 1,
      };
      await recordEvent({
        outlet_id: t.outlet_id,
        entity_type: "ORDER",
        entity_id: t.order_id,
        event_type: "KITCHEN_TICKET_UPDATED",
        from_state: from,
        to_state: "SERVED",
        actor_id: params?.by ?? "staff",
        metadata: { completion_serve: true, kot_id: t.id, lines: liveLines.length },
      });
    });
  }
  if (openIds.length > 0) {
    const { refreshOrderKitchenState } = await import("@/features/orders/api/service");
    await refreshOrderKitchenState(orderId);
  }
  return openIds.length;
}

async function mutateTicket(
  id: string,
  fn: (idx: number) => Promise<void>,
): Promise<KitchenTicketWithDerived> {
  const release = await entityMutex.acquire(`kot-${id}`);
  try {
    loadTickets(); // re-read under lock so a concurrent tab's write isn't clobbered
    const idx = mockTickets.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("KOT not found");
    await fn(idx);
    saveTickets();
    publishTicket(mockTickets[idx]);
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
        lines: consumed
          .map((l) => {
            const ol = order?.items.find((i) => i.id === l.order_line_id);
            return {
              recipe_id: ol?.recipe_id_snapshot ?? "",
              variant_id: ol?.variant_id,
              servings: l.qty - l.voided_qty,
            };
          })
          .filter((l) => l.recipe_id),
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
 * Post-sale item return on a KOT line. Unlike voids (pre-service), returns
 * work on SERVED lines and tickets: the qty is marked returned (never
 * re-billable), recorded on the ticket, and wasted (returned food is never
 * restocked). The bill adjustment + same-method refund live in the orders and
 * payments domains; this command owns kitchen truth only.
 */
export async function returnKOTLine(
  id: string,
  lineId: string,
  params: { qty: number; amount_paise: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return mutateTicket(id, async (idx) => {
    const t = mockTickets[idx];
    if (!params.reason?.trim()) throw new Error("A reason is required to return an item");
    if (t.status === "CANCELLED") throw new Error("Cannot return from a cancelled KOT");
    const li = t.lines.findIndex((l) => l.id === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = t.lines[li];
    const returnable = line.qty - line.voided_qty - (line.returned_qty ?? 0);
    if (returnable <= 0) throw new Error("Nothing returnable left on this line");
    const qty = params.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > returnable) {
      throw new Error(`Return qty must be between 1 and ${returnable}`);
    }
    if (!Number.isInteger(params.amount_paise) || params.amount_paise < 0) {
      throw new Error("Return amount must be a non-negative paise integer");
    }
    const now = new Date().toISOString();
    const lines = [...t.lines];
    lines[li] = { ...line, returned_qty: (line.returned_qty ?? 0) + qty };
    mockTickets[idx] = {
      ...t,
      lines,
      returns: [
        ...(t.returns ?? []),
        {
          id: `ret_${Date.now().toString(36)}`,
          kot_line_id: lineId,
          order_line_id: line.order_line_id,
          qty,
          amount_paise: params.amount_paise,
          reason: params.reason.trim(),
          returned_by: params.by ?? "staff",
          created_at: now,
        },
      ],
      updated_at: now,
      version: t.version + 1,
    };
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
    await recordEvent({
      outlet_id: t.outlet_id,
      entity_type: "ORDER",
      entity_id: t.order_id,
      event_type: "KOT_LINE_RETURNED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason.trim(),
      metadata: { kot_id: id, kot_line_id: lineId, qty, amount_paise: params.amount_paise },
    });
  });
}

/**
 * Terminal fast path: add the item, fire immediately.
 * No draft step — the item lands straight on a new KOT.
 */
export async function addAndFireItem(
  orderId: string,
  input: AddItemInput,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  await addOrderItem(orderId, input);
  return fireKOT(orderId, by);
}

/**
 * Batch variant: add N lines, then fire ONE KOT containing all of them.
 * Used by the add-items dialog — one dialog batch = one KOT with N items.
 */
export async function addManyAndFire(
  orderId: string,
  inputs: AddItemInput[],
  by?: string,
): Promise<KitchenTicketWithDerived> {
  if (inputs.length === 0) throw new Error("Nothing to fire");
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  for (const input of inputs) {
    await addOrderItem(orderId, input);
  }
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

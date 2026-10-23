/**
 * Kitchen/KDS domain — client service (server-backed).
 *
 * Thin fetch layer over /api/kots*. Same exported API as the old
 * localStorage version. Ticket transitions run server-side; the wallboard
 * polls the server feed (KDS_SSE remains the client push fan-out).
 */
import { getServiceOutletId } from "@/features/outlet/api/outlets";
import type { AddItemInput } from "@/features/orders/api/types";
import type { KitchenTicketWithDerived, KOTFilters } from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Fire-and-forget fan-out to the KDS live feed (Neon function). Never
 * throws: offline or misconfigured feed must not break kitchen work.
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

function publishTicket(t: KitchenTicketWithDerived, extra?: Record<string, unknown>): void {
  publishKds("kot", {
    kot_id: t.id,
    order_id: t.order_id,
    status: t.status,
    kot_number: t.kot_number,
    ...extra,
  });
}

export async function getKitchenTickets(filters?: KOTFilters): Promise<KitchenTicketWithDerived[]> {
  const { rows } = await api<{ rows: KitchenTicketWithDerived[] }>(
    `/api/kots${toQuery({
      outlet_id: filters?.outlet_id ?? getServiceOutletId() ?? undefined,
      status: filters?.status as string | undefined,
    })}`,
  );
  return rows ?? [];
}

export async function getKOTsByOrder(orderId: string): Promise<KitchenTicketWithDerived[]> {
  const { tickets } = await api<{ tickets: KitchenTicketWithDerived[] }>(
    `/api/kots/by-order/${encodeURIComponent(orderId)}`,
  );
  return tickets ?? [];
}

export async function getTicketById(id: string): Promise<KitchenTicketWithDerived | null> {
  try {
    const { ticket } = await api<{ ticket: KitchenTicketWithDerived | null }>(
      `/api/kots/${encodeURIComponent(id)}`,
    );
    return ticket ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function fireKOT(
  orderId: string,
  by?: string,
  opts?: { stationIds?: string[] },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await api<{ ok: boolean; ticket: KitchenTicketWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/fire`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ by, stationIds: opts?.stationIds }),
    },
  );
  publishTicket(ticket, { lines: ticket.lines.length });
  return ticket;
}

async function transition(
  id: string,
  action: string,
  body: Record<string, unknown> = {},
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await api<{ ok: boolean; ticket: KitchenTicketWithDerived }>(
    `/api/kots/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    },
  );
  publishTicket(ticket);
  return ticket;
}

export async function acceptKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return transition(id, "accept", { by });
}

export async function startPreparingKOT(
  id: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return transition(id, "prepare", { by });
}

export async function acceptKOTLine(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return transition(id, "accept-line", { line_id: lineId, by });
}

export async function startPreparingKOTLine(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return transition(id, "start-line", { line_id: lineId, by });
}

export async function markLineReady(
  id: string,
  lineId: string,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  return transition(id, "line-ready", { line_id: lineId, by });
}

export async function serveKOT(id: string, by?: string): Promise<KitchenTicketWithDerived> {
  return transition(id, "serve", { by });
}

export async function serveOpenTickets(orderId: string, params?: { by?: string }): Promise<number> {
  // Completion/dispatch routes serve open tickets server-side before the
  // order transition; the client entry stays for compatibility.
  const { getOrderById } = await import("@/features/orders/api/service");
  const order = await getOrderById(orderId);
  void order;
  void params;
  throw new Error(
    "serveOpenTickets runs server-side inside complete/dispatch — no client call needed",
  );
}

export async function voidKOT(
  id: string,
  params: { reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return transition(id, "void", params);
}

export async function voidKOTLine(
  id: string,
  lineId: string,
  params: { qty?: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return transition(id, "void-line", { line_id: lineId, ...params });
}

export async function returnKOTLine(
  id: string,
  lineId: string,
  params: { qty: number; amount_paise: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  return transition(id, "return-line", { line_id: lineId, ...params });
}

export async function addAndFireItem(
  orderId: string,
  input: AddItemInput,
  by?: string,
): Promise<KitchenTicketWithDerived> {
  const { addOrderItem } = await import("@/features/orders/api/service");
  await addOrderItem(orderId, input);
  return fireKOT(orderId, by);
}

export async function addManyAndFire(
  orderId: string,
  inputs: AddItemInput[],
  by?: string,
): Promise<KitchenTicketWithDerived> {
  if (inputs.length === 0) throw new Error("Nothing to fire");
  const { addOrderItem } = await import("@/features/orders/api/service");
  for (const input of inputs) {
    await addOrderItem(orderId, input);
  }
  return fireKOT(orderId, by);
}

export async function increaseKOTLineQty(
  id: string,
  lineId: string,
  params: { extra: number; by?: string },
): Promise<KitchenTicketWithDerived> {
  return transition(id, "increase-qty", { line_id: lineId, ...params });
}

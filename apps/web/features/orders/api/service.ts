/**
 * Orders domain — client service (server-backed).
 *
 * Thin fetch layer over /api/orders*. Same exported API as the old
 * localStorage version so all callers (terminal, bill panel, dispatch,
 * rider) work unchanged. The server is the single source of truth — no
 * local persistence, no mock data, no sync eligibility.
 *
 * Server-only flows (KOT linkage, payment-state derivation, kitchen walk)
 * live in features/orders/api/server.ts and the route handlers.
 */
import { getServiceOutletId } from "@/features/outlet/api/outlets";
import type {
  AddItemInput,
  BillingView,
  CreateOrderInput,
  ItemSalesFilters,
  ItemSalesStat,
  OrderFilters,
  OrderReturn,
  OrderWithDerived,
} from "./types";

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

/* ---------------- reads ---------------- */

export async function getOrders(filters?: OrderFilters): Promise<OrderWithDerived[]> {
  const { rows } = await api<{ rows: OrderWithDerived[] }>(
    `/api/orders${toQuery({
      outlet_id: filters?.outlet_id ?? getServiceOutletId() ?? undefined,
      status: filters?.status as string | undefined,
      channel: filters?.channel as string | undefined,
      table_id: filters?.table_id,
      customer_id: filters?.customer_id,
      search: filters?.search,
    })}`,
  );
  return rows ?? [];
}

export async function getOrderById(id: string): Promise<OrderWithDerived | null> {
  try {
    const { order } = await api<{ order: OrderWithDerived | null }>(
      `/api/orders/${encodeURIComponent(id)}`,
    );
    return order ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function getOrderWithBilling(orderId: string): Promise<BillingView | null> {
  try {
    const data = await api<BillingView>(`/api/orders/${encodeURIComponent(orderId)}/billing`);
    return data;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function itemSalesStats(filters?: ItemSalesFilters): Promise<ItemSalesStat[]> {
  const { rows } = await api<{ rows: ItemSalesStat[] }>(
    `/api/reports/item-sales${toQuery({
      outlet_id: filters?.outlet_id as string | undefined,
      from: filters?.from,
      to: filters?.to,
      channel: filters?.channel as string | undefined,
    })}`,
  );
  return rows ?? [];
}

/* ---------------- create / items ---------------- */

export async function createOrder(input: CreateOrderInput): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(`/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...input,
      outlet_id: input.outlet_id ?? getServiceOutletId() ?? undefined,
    }),
  });
  return order;
}

export async function addOrderItem(
  orderId: string,
  input: AddItemInput,
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/items`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return order;
}

export async function updateDraftItemQty(
  orderId: string,
  lineId: string,
  qty: number,
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(lineId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qty }),
    },
  );
  return order;
}

export async function removeDraftItem(orderId: string, lineId: string): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(lineId)}`,
    { method: "DELETE" },
  );
  return order;
}

export async function confirmOrder(orderId: string, by?: string): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ by }),
    },
  );
  return order;
}

/* ---------------- ensure (terminal capture) ---------------- */

async function ensure(
  mode: "table" | "bare" | "group",
  ref: { table_id?: string; group_id?: string },
  params?: { by?: string; off_hours_reason?: string },
): Promise<OrderWithDerived> {
  const outletId = getServiceOutletId();
  if (!outletId) throw new Error("No outlet selected — select an outlet first");
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(`/api/orders/ensure`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode,
      outlet_id: outletId,
      table_id: ref.table_id,
      group_id: ref.group_id,
      by: params?.by,
      off_hours_reason: params?.off_hours_reason,
    }),
  });
  return order;
}

export async function ensureTableOrder(
  tableId: string,
  params?: { by?: string; off_hours_reason?: string },
): Promise<OrderWithDerived> {
  return ensure("table", { table_id: tableId }, params);
}

export async function ensureBareTableOrder(
  tableId: string,
  params?: { by?: string; off_hours_reason?: string },
): Promise<OrderWithDerived> {
  return ensure("bare", { table_id: tableId }, params);
}

export async function ensureGroupOrder(
  groupId: string,
  params?: { by?: string; off_hours_reason?: string },
): Promise<OrderWithDerived> {
  return ensure("group", { group_id: groupId }, params);
}

/* ---------------- lifecycle ---------------- */

export async function cancelOrder(
  orderId: string,
  params: { reason: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  return order;
}

export async function completeOrder(
  orderId: string,
  params?: { by?: string; reason?: string; force?: boolean },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params ?? {}),
    },
  );
  return order;
}

export async function deleteOrder(orderId: string, by?: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/orders/${encodeURIComponent(orderId)}${toQuery({ by })}`, {
    method: "DELETE",
  });
}

export async function discardEmptyDrafts(outletId?: string): Promise<number> {
  const { discarded } = await api<{ ok: boolean; discarded: number }>(`/api/orders/discard-empty`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outlet_id: outletId ?? getServiceOutletId() ?? undefined }),
  });
  return discarded ?? 0;
}

/* ---------------- dispatch ---------------- */

export async function assignRider(
  orderId: string,
  params: { rider_name: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/dispatch`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "assign-rider", ...params }),
    },
  );
  return order;
}

export async function dispatchOrder(
  orderId: string,
  params?: { by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/dispatch`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "dispatch", ...params }),
    },
  );
  return order;
}

export async function markDelivered(
  orderId: string,
  params?: { by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/dispatch`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "deliver", ...params }),
    },
  );
  return order;
}

export async function setDeliveryAddress(
  orderId: string,
  params: { delivery_address: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/dispatch`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "address", ...params }),
    },
  );
  return order;
}

/* ---------------- billing: discount / split / customer ---------------- */

export async function setDiscount(
  orderId: string,
  params: { percent?: number; amount_paise?: number; reason: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/discount`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  return order;
}

export async function computeSplits(
  orderId: string,
  params:
    | { mode: "equal"; count: number }
    | { mode: "itemwise"; assignments: { label: string; line_ids: string[] }[] }
    | { mode: "custom"; amounts: { label: string; amount_paise: number }[] },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/split`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  return order;
}

export async function clearSplit(
  orderId: string,
  params: { reason: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/split${toQuery({ reason: params.reason })}`,
    { method: "DELETE" },
  );
  return order;
}

export async function linkCustomer(orderId: string, customerId: string): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/customer`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "link", customer_id: customerId }),
    },
  );
  return order;
}

export async function setCustomerNotes(orderId: string, notes: string): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/customer`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "notes", notes }),
    },
  );
  return order;
}

export async function unlinkCustomer(
  orderId: string,
  params?: { reason?: string; by?: string },
): Promise<OrderWithDerived> {
  const { order } = await api<{ ok: boolean; order: OrderWithDerived }>(
    `/api/orders/${encodeURIComponent(orderId)}/customer`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "unlink", ...params }),
    },
  );
  return order;
}

/* ---------------- returns ---------------- */

export async function getReturnsByOrder(orderId: string): Promise<OrderReturn[]> {
  const { rows } = await api<{ rows: import("@/features/payments/api/types").Refund[] }>(
    `/api/payments${toQuery({ kind: "refund", order_id: orderId })}`,
  );
  const byReturn = new Map<string, OrderReturn>();
  for (const r of rows ?? []) {
    const key = (r.return_id as string | undefined) ?? r.id;
    const e = byReturn.get(key) ?? {
      id: key,
      order_id: orderId,
      outlet_id: r.outlet_id,
      lines: [],
      total_paise: 0,
      reason: r.reason,
      created_by: r.created_by,
      created_at: r.created_at,
    };
    e.total_paise += r.amount_paise;
    if (r.order_line_id && r.qty) {
      e.lines.push({ order_line_id: r.order_line_id, qty: r.qty, amount_paise: r.amount_paise });
    }
    byReturn.set(key, e);
  }
  return [...byReturn.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createReturn(
  orderId: string,
  params: { lines: { order_line_id: string; qty: number }[]; reason: string; by?: string },
): Promise<{ order: OrderWithDerived; ret: OrderReturn }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  let total = 0;
  for (const l of params.lines) {
    const line = order.items.find((i) => i.id === l.order_line_id);
    if (!line) throw new Error("Order line not found");
    total += line.unit_price_paise * l.qty;
  }
  const data = await api<{
    ok: boolean;
    order: OrderWithDerived;
    return_id: string;
    total_paise: number;
  }>(`/api/orders/${encodeURIComponent(orderId)}/returns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...params, total_paise: total }),
  });
  const ret: OrderReturn = {
    id: data.return_id,
    order_id: orderId,
    outlet_id: order.outlet_id,
    lines: params.lines.map((l) => ({
      order_line_id: l.order_line_id,
      qty: l.qty,
      amount_paise:
        (order.items.find((i) => i.id === l.order_line_id)?.unit_price_paise ?? 0) * l.qty,
    })),
    total_paise: data.total_paise,
    reason: params.reason,
    created_by: params.by,
    created_at: new Date().toISOString(),
  };
  return { order: data.order, ret };
}

/* ---------------- deferred catalog operations (v2) ---------------- */

export async function applyPromo(_orderId?: string, _code?: string): Promise<OrderWithDerived> {
  void _orderId;
  void _code;
  throw new Error("Promo codes are not available in this build");
}

export async function removePromo(_orderId?: string): Promise<OrderWithDerived> {
  void _orderId;
  throw new Error("Promo codes are not available in this build");
}

export async function redeemRewards(
  _orderId?: string,
  _points?: number,
): Promise<OrderWithDerived> {
  void _orderId;
  void _points;
  throw new Error("Reward redemption is not available in this build");
}

export async function removeRewardsRedeem(_orderId?: string): Promise<OrderWithDerived> {
  void _orderId;
  throw new Error("Reward redemption is not available in this build");
}

import { delay } from "@/constants/mock-api";
import type { OrderChannel, OrderItemSnapshot } from "@/features/orders/api/types";
import type { PromoCode, PromoEvaluation, PromoPayload, PromoRedemption } from "./types";

const PROMO_KEY = "pixaPromos";
const REDEEM_KEY = "pixaPromoRedemptions";

let mockPromos: PromoCode[] = [];
let mockRedeems: PromoRedemption[] = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(PROMO_KEY);
    if (raw) mockPromos = JSON.parse(raw).promos ?? [];
  } catch {}
  try {
    const raw = localStorage.getItem(REDEEM_KEY);
    if (raw) mockRedeems = JSON.parse(raw).redemptions ?? [];
  } catch {}
}

function save() {
  try {
    localStorage.setItem(PROMO_KEY, JSON.stringify({ promos: mockPromos }));
    localStorage.setItem(REDEEM_KEY, JSON.stringify({ redemptions: mockRedeems }));
  } catch {}
}

const OUTLET = "out_001";

function cleanCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function getPromos(): Promise<PromoCode[]> {
  await delay(200);
  load();
  return [...mockPromos].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPromoById(id: string): Promise<PromoCode | null> {
  await delay(150);
  load();
  return mockPromos.find((p) => p.id === id) ?? null;
}

export async function getPromoByCode(code: string): Promise<PromoCode | null> {
  await delay(150);
  load();
  return mockPromos.find((p) => p.code === cleanCode(code)) ?? null;
}

function validatePayload(p: PromoPayload, ignoreId?: string) {
  const code = cleanCode(p.code);
  if (!code) throw new Error("Code is required (e.g. DIWALI10)");
  if (!/^[A-Z0-9_-]{3,20}$/.test(code))
    throw new Error("Code: 3–20 chars, letters/digits/_/- only");
  if (mockPromos.some((x) => x.code === code && x.id !== ignoreId))
    throw new Error(`Code ${code} already exists`);
  if (p.kind === "percent" && (!(p.value > 0) || p.value > 100))
    throw new Error("Percent must be 1–100");
  if (p.kind === "flat" && (!(p.value > 0) || !Number.isFinite(p.value)))
    throw new Error("Flat amount must be positive (paise)");
  if (p.scope !== "order" && (p.target_ids ?? []).length === 0)
    throw new Error("Item/category promos need at least one target");
  if (p.starts_at && p.ends_at && new Date(p.starts_at) > new Date(p.ends_at))
    throw new Error("Starts-at must be before ends-at");
  return code;
}

export async function createPromo(payload: PromoPayload): Promise<PromoCode> {
  await delay(400);
  load();
  const code = validatePayload(payload);
  const now = new Date().toISOString();
  const promo: PromoCode = {
    id: `promo_${Date.now().toString(36)}`,
    outlet_id: OUTLET,
    code,
    name: payload.name?.trim() || code,
    kind: payload.kind,
    value: payload.kind === "flat" ? Math.round(payload.value) : payload.value,
    scope: payload.scope,
    target_ids: payload.target_ids ?? [],
    channels: payload.channels ?? [],
    min_order_paise: payload.min_order_paise,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    usage_limit: payload.usage_limit,
    per_customer_limit: payload.per_customer_limit,
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockPromos.push(promo);
  save();
  return { ...promo };
}

export async function updatePromo(id: string, payload: Partial<PromoPayload>): Promise<PromoCode> {
  await delay(400);
  load();
  const idx = mockPromos.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Promo not found");
  const merged: PromoPayload = {
    code: payload.code ?? mockPromos[idx].code,
    name: payload.name ?? mockPromos[idx].name,
    kind: payload.kind ?? mockPromos[idx].kind,
    value: payload.value ?? mockPromos[idx].value,
    scope: payload.scope ?? mockPromos[idx].scope,
    target_ids: payload.target_ids ?? mockPromos[idx].target_ids,
    channels: payload.channels ?? mockPromos[idx].channels,
    min_order_paise: payload.min_order_paise ?? mockPromos[idx].min_order_paise,
    starts_at: payload.starts_at ?? mockPromos[idx].starts_at,
    ends_at: payload.ends_at ?? mockPromos[idx].ends_at,
    usage_limit: payload.usage_limit ?? mockPromos[idx].usage_limit,
    per_customer_limit: payload.per_customer_limit ?? mockPromos[idx].per_customer_limit,
    is_active: payload.is_active ?? mockPromos[idx].is_active,
  };
  const code = validatePayload(merged, id);
  mockPromos[idx] = {
    ...mockPromos[idx],
    ...merged,
    code,
    value: merged.kind === "flat" ? Math.round(merged.value) : merged.value,
    updated_at: new Date().toISOString(),
  };
  save();
  return { ...mockPromos[idx] };
}

export async function promoUsage(
  promoId: string,
): Promise<{ total: number; amount_paise: number }> {
  await delay(100);
  load();
  const rows = mockRedeems.filter((r) => r.promo_id === promoId);
  return {
    total: rows.length,
    amount_paise: rows.reduce((s, r) => s + r.amount_paise, 0),
  };
}

export async function recordRedemption(
  r: Omit<PromoRedemption, "id" | "created_at">,
): Promise<void> {
  load();
  mockRedeems.push({
    ...r,
    id: `pr_${Date.now().toString(36)}`,
    created_at: new Date().toISOString(),
  });
  save();
}

/** Remove an order's redemptions (promo replaced/removed before completion). */
export async function voidRedemptionsForOrder(orderId: string): Promise<void> {
  load();
  mockRedeems = mockRedeems.filter((r) => r.order_id !== orderId);
  save();
}

export async function customerPromoUses(promoId: string, customerId: string): Promise<number> {
  load();
  return mockRedeems.filter((r) => r.promo_id === promoId && r.customer_id === customerId).length;
}

/** Live line value (returned qty excluded) — mirrors recomputeTotals. */
function liveValue(l: OrderItemSnapshot): number {
  const live = l.qty - (l.returned_qty ?? 0);
  if (live <= 0) return 0;
  return Math.round((l.line_total_paise * live) / Math.max(1, l.qty));
}

export type PromoOrderView = {
  subtotal_paise: number;
  channel: OrderChannel;
  customer_id?: string;
  items: (OrderItemSnapshot & { category_id?: string })[];
};

function amountFor(promo: PromoCode, eligible: number, qtyUnits?: number): number {
  if (eligible <= 0) return 0;
  if (promo.kind === "percent")
    return Math.min(eligible, Math.round((eligible * promo.value) / 100));
  // flat: order scope = whole-bill cap; item/category scope = per-unit cap.
  if (promo.scope === "order") return Math.min(eligible, Math.round(promo.value));
  return Math.min(eligible, Math.round(promo.value) * Math.max(1, qtyUnits ?? 1));
}

/**
 * Pure evaluator: returns the discount for a promo against a draft order, or
 * throws a staff-readable reason. Category matching needs `category_id` on
 * the view lines (applyPromo resolves it from the catalog).
 */
export function evaluatePromo(
  promo: PromoCode,
  order: PromoOrderView,
  now = new Date(),
): PromoEvaluation {
  if (!promo.is_active) throw new Error(`Promo ${promo.code} is inactive`);
  if (promo.starts_at && now < new Date(promo.starts_at))
    throw new Error(`Promo ${promo.code} starts ${promo.starts_at.slice(0, 10)}`);
  if (promo.ends_at && now > new Date(promo.ends_at))
    throw new Error(`Promo ${promo.code} expired ${promo.ends_at.slice(0, 10)}`);
  if (promo.channels.length > 0 && !promo.channels.includes(order.channel))
    throw new Error(
      `Promo ${promo.code} is not valid for ${order.channel.replace("_", " ")} orders`,
    );
  if ((promo.min_order_paise ?? 0) > order.subtotal_paise)
    throw new Error(
      `Promo ${promo.code} needs a minimum bill of ₹${((promo.min_order_paise ?? 0) / 100).toFixed(0)}`,
    );
  let eligible = 0;
  let units = 0;
  if (promo.scope === "order") {
    eligible = order.subtotal_paise;
    units = 1;
  } else {
    for (const l of order.items) {
      const hit =
        promo.scope === "item"
          ? promo.target_ids.includes(l.menu_item_id)
          : promo.target_ids.includes(l.category_id ?? "");
      if (!hit) continue;
      eligible += liveValue(l);
      units += Math.max(0, l.qty - (l.returned_qty ?? 0));
    }
    if (eligible <= 0) throw new Error(`Promo ${promo.code} matches no items on this bill`);
  }
  const amount = amountFor(promo, eligible, units);
  if (amount <= 0) throw new Error(`Promo ${promo.code} gives no discount on this bill`);
  return { promo, amount_paise: amount, eligible_paise: eligible };
}

export async function checkPromoLimits(promo: PromoCode, customerId?: string): Promise<void> {
  load();
  if (promo.usage_limit != null) {
    const used = mockRedeems.filter((r) => r.promo_id === promo.id).length;
    if (used >= promo.usage_limit) throw new Error(`Promo ${promo.code} hit its usage limit`);
  }
  if (promo.per_customer_limit != null && customerId) {
    const mine = mockRedeems.filter(
      (r) => r.promo_id === promo.id && r.customer_id === customerId,
    ).length;
    if (mine >= promo.per_customer_limit)
      throw new Error(`Customer already used promo ${promo.code} ${mine}×`);
  }
}

import type { OrderChannel } from "@/features/orders/api/types";

export type PromoKind = "percent" | "flat" | "bogo" | "freebie";
export type PromoScope = "order" | "item" | "category";

/**
 * Promo/coupon code. Scope decides what `target_ids` hold: menu_item_ids
 * (item), category_ids (category), unused for order-wide. `channels` empty =
 * all channels. Value is percent (0–100) or flat paise (order scope) / flat
 * paise per unit (item/category scope), always capped at the eligible value.
 *
 * Delight mechanics:
 * - bogo: buy `buy_qty`, get `get_qty` free from the SAME scoped pool
 *   (BOGO = 1/1, buy-2-get-1 = 2/1). Free units valued at the pool's average
 *   unit price, cheapest-first by construction.
 * - freebie: buy `buy_qty` units from the scope pool → `get_qty` ×
 *   `get_menu_item_id` free (e.g. pizza → free burger). The free item must be
 *   on the bill; its live value caps the discount.
 */
export type PromoCode = {
  id: string;
  outlet_id: string;
  code: string; // upper-cased, unique per outlet
  name: string;
  kind: PromoKind;
  value: number; // percent | paise (ignored for bogo/freebie)
  scope: PromoScope;
  target_ids: string[];
  channels: OrderChannel[];
  /** BOGO/freebie: buy this many scope units… */
  buy_qty?: number;
  /** …get this many free (bogo: same pool; freebie: of get_menu_item_id). */
  get_qty?: number;
  /** Freebie free item (menu_item_id). */
  get_menu_item_id?: string;
  min_order_paise?: number;
  starts_at?: string; // ISO
  ends_at?: string; // ISO
  usage_limit?: number; // total redemptions
  per_customer_limit?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromoPayload = {
  code: string;
  name?: string;
  kind: PromoKind;
  value: number;
  scope: PromoScope;
  target_ids?: string[];
  channels?: OrderChannel[];
  buy_qty?: number;
  get_qty?: number;
  get_menu_item_id?: string;
  min_order_paise?: number;
  starts_at?: string;
  ends_at?: string;
  usage_limit?: number;
  per_customer_limit?: number;
  is_active?: boolean;
};

export type PromoRedemption = {
  id: string;
  promo_id: string;
  order_id: string;
  customer_id?: string;
  amount_paise: number;
  created_at: string;
};

export type PromoEvaluation = {
  promo: PromoCode;
  amount_paise: number;
  eligible_paise: number;
};

import type { OrderChannel } from "@/features/orders/api/types";

export type PromoKind = "percent" | "flat";
export type PromoScope = "order" | "item" | "category";

/**
 * Promo/coupon code. Scope decides what `target_ids` hold: menu_item_ids
 * (item), category_ids (category), unused for order-wide. `channels` empty =
 * all channels. Value is percent (0–100) or flat paise (order scope) / flat
 * paise per unit (item/category scope), always capped at the eligible value.
 */
export type PromoCode = {
  id: string;
  outlet_id: string;
  code: string; // upper-cased, unique per outlet
  name: string;
  kind: PromoKind;
  value: number; // percent | paise
  scope: PromoScope;
  target_ids: string[];
  channels: OrderChannel[];
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

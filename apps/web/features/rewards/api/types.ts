/** Points ledger reason. */
export type RewardReason = "earn" | "redeem" | "void" | "adjust";

export type RewardEntry = {
  id: string;
  customer_id: string;
  order_id?: string;
  delta_points: number; // +earn, -redeem
  balance_after: number;
  reason: RewardReason;
  note?: string;
  created_at: string;
};

export const REWARD_RULES = {
  /** Earn 1 pt per this many paise of completed bill. */
  earn_paise_per_point: 1000, // ₹10
  /** Redeem value per point, in paise. */
  redeem_paise_per_point: 100, // ₹1
} as const;

/**
 * Versioned program rules: rates change over time with an effective window.
 * Creating a rule auto-closes the previous open one (its to_at = new from).
 * Earn/redeem always use the rule active at the transaction time.
 */
export type RewardRules = {
  id: string;
  earn_paise_per_point: number;
  redeem_paise_per_point: number;
  from_at: string; // ISO — effective from (default: now)
  to_at?: string; // ISO — optional end; open-ended when absent
  created_at: string;
};

export type RewardRulesPayload = {
  /** Rupees per point earned (e.g. 10 = 1 pt per ₹10). */
  earn_rupees_per_point: number;
  /** Rupees value per point tendered (e.g. 1 = 1 pt = ₹1). */
  redeem_rupees_per_point: number;
  from_at?: string; // default now
  to_at?: string; // optional
};

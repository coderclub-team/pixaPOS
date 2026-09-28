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

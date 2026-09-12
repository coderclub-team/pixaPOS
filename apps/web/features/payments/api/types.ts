export type PaymentMethod =
  | "cash"
  | "upi"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "wallet";

export type PaymentStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

export type RefundStatus = "REFUND_PENDING" | "REFUNDED";

export type Payment = {
  id: string;
  outlet_id: string;
  order_id: string;
  method: PaymentMethod;
  amount_paise: number;
  /** Cash over-tender only; change is returned, never revenue. */
  tendered_paise?: number;
  change_paise?: number;
  partition_label?: string;
  status: PaymentStatus;
  received_by?: string;
  created_at: string;
  updated_at: string;
};

export type Refund = {
  id: string;
  payment_id: string;
  order_id: string;
  outlet_id: string;
  amount_paise: number;
  reason: string;
  status: RefundStatus;
  created_by?: string;
  created_at: string;
};

export type PaymentFilters = {
  order_id?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  outlet_id?: string;
};

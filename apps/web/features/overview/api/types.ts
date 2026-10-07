import type { OrderChannel } from "@/features/orders/api/types";
import type { PaymentMethod } from "@/features/payments/api/types";

export type { OrderChannel, PaymentMethod };

export type OverviewRange = "today" | "7d" | "30d";

export type OverviewFilters = {
  range: OverviewRange;
  /** undefined = all channels. */
  channel?: OrderChannel;
  /** undefined = all outlets. */
  outlet_id?: string;
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  dine_in: "Dine-in",
  counter: "Counter",
  takeaway: "Takeaway",
  delivery: "Delivery",
  zomato: "Zomato",
  swiggy: "Swiggy",
  own_online: "Online",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  debit_card: "Debit card",
  credit_card: "Credit card",
  bank_transfer: "Bank transfer",
  wallet: "Wallet",
};

export const PAYMENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
];

export type OverviewKpis = {
  revenue_paise: number;
  orders: number;
  avg_bill_paise: number;
  live_orders: number;
  occupied_tables: number;
  /** % change vs the previous equal-length window (null when nothing to compare). */
  revenue_delta_pct: number | null;
};

export type TrendPoint = {
  label: string;
  /** Bill total for the bucket (₹ render at the edge; paise internally). */
  net_paise: number;
  orders: number;
};

export type ChannelStat = {
  channel: OrderChannel;
  label: string;
  orders: number;
  net_paise: number;
};

export type PaymentStat = {
  method: PaymentMethod;
  label: string;
  amount_paise: number;
};

export type OverviewRecentOrder = {
  id: string;
  order_number: string;
  channel: OrderChannel;
  channel_label: string;
  total_paise: number;
  status: string;
  created_at: string;
  table_number?: string;
  customer_name?: string;
};

export type OverviewItem = {
  menu_item_id: string;
  name: string;
  qty: number;
  net_paise: number;
};

export type OverviewOutlet = { id: string; label: string };

export type OverviewData = {
  kpis: OverviewKpis;
  trend: TrendPoint[];
  channels: ChannelStat[];
  payments: PaymentStat[];
  recent: OverviewRecentOrder[];
  top_items: OverviewItem[];
  slow_items: OverviewItem[];
  outlets: OverviewOutlet[];
  from: string;
  to: string;
};

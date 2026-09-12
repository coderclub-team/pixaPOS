export type OrderChannel =
  | "dine_in"
  | "takeaway"
  | "delivery"
  | "zomato"
  | "swiggy"
  | "own_online";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_KITCHEN"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderItemSnapshot = {
  id: string;
  menu_item_id: string;
  variant_id?: string;
  /** Sale-time snapshots — catalog changes must never mutate history. */
  item_name_snapshot: string;
  variant_name_snapshot?: string;
  unit_price_paise: number;
  tax_percent_snapshot: number;
  recipe_id_snapshot?: string;
  modifiers: { modifier_id: string; name_snapshot: string; price_paise: number }[];
  qty: number;
  line_total_paise: number;
  line_tax_paise: number;
  instructions?: string;
  /** Set when this draft line is fired to the kitchen. */
  kot_id?: string;
  kot_line_id?: string;
};

export type RestaurantOrder = {
  id: string;
  outlet_id: string;
  order_number: string;
  channel: OrderChannel;
  table_id?: string;
  table_number_snapshot?: string;
  occupancy_group_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  external_ref?: string;
  status: OrderStatus;
  items: OrderItemSnapshot[];
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  /** Bill-level discount (pre-tax). total_paise stays pre-discount for history. */
  discount_percent?: number;
  discount_paise?: number;
  discount_reason?: string;
  grand_total_paise: number;
  payment_status: PaymentState;
  split?: BillSplit;
  cancelled_reason?: string;
  cancelled_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at?: string | null;
};

export type PaymentState = "UNPAID" | "PARTIAL" | "PAID";

export type SplitMode = "equal" | "itemwise" | "custom";

export type BillPartition = {
  label: string;
  /** itemwise: covered line ids. custom: fixed amount. equal: share count. */
  line_ids?: string[];
  amount_paise: number;
};

export type BillSplit = {
  mode: SplitMode;
  partitions: BillPartition[];
  created_at: string;
};

export type BillingView = {
  order: RestaurantOrder;
  paid_paise: number;
  balance_paise: number;
};

export type OrderWithDerived = RestaurantOrder & {
  fired_items: number;
  draft_items: number;
  kot_count: number;
};

export type CreateOrderInput = {
  outlet_id?: string;
  channel: OrderChannel;
  table_id?: string;
  occupancy_group_id?: string;
  customer_name?: string;
  customer_phone?: string;
  external_ref?: string;
  created_by?: string;
};

export type AddItemInput = {
  menu_item_id: string;
  variant_id?: string;
  modifier_ids?: string[];
  qty?: number;
  instructions?: string;
};

export type OrderFilters = {
  search?: string;
  channel?: OrderChannel;
  status?: OrderStatus;
  table_id?: string;
  customer_id?: string;
  outlet_id?: string;
};

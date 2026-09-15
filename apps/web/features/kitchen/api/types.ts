export type KOTStatus = "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

export type KOTLineStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "VOIDED";

export type KOTLine = {
  id: string;
  order_line_id: string;
  item_name_snapshot: string;
  variant_name_snapshot?: string;
  modifiers_snapshot: string[];
  instructions?: string;
  qty: number;
  /** Qty voided so far (partial voids allowed). */
  voided_qty: number;
  /** Qty returned post-sale (served lines only). Never re-billable. */
  returned_qty: number;
  status: KOTLineStatus;
};

/** Return record — post-sale item returns, recorded on the KOT like voids. */
export type KOTReturnRecord = {
  id: string;
  kot_line_id?: string;
  order_line_id: string;
  qty: number;
  amount_paise: number;
  reason: string;
  returned_by?: string;
  created_at: string;
};
export type KOTVoidRecord = {
  id: string;
  kot_line_id?: string;
  qty: number;
  reason: string;
  voided_by?: string;
  created_at: string;
};

export type KitchenTicket = {
  id: string;
  outlet_id: string;
  order_id: string;
  order_number_snapshot: string;
  table_number_snapshot?: string;
  channel: string;
  kot_number: number;
  status: KOTStatus;
  lines: KOTLine[];
  voids: KOTVoidRecord[];
  returns: KOTReturnRecord[];
  fired_by?: string;
  fired_at: string;
  updated_at: string;
  version: number;
};

export type KitchenTicketWithDerived = KitchenTicket & {
  pending_lines: number;
  ready_lines: number;
  age_minutes: number;
};

export type KOTFilters = {
  status?: KOTStatus;
  outlet_id?: string;
};

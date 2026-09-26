export type Outlet = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  alias?: string;
  type: string;
  logo_url?: string | File[];
  phone: string;
  alternate_phone?: string;
  email: string;
  website?: string;
  whatsapp?: string;
  address_line_1: string;
  address_line_2?: string;
  locality: string;
  city: string;
  district?: string;
  state: string;
  country: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  gst_registered: boolean;
  gstin?: string;
  legal_name?: string;
  pan?: string;
  fssai_number?: string;
  currency: string;
  timezone: string;
  locale: string;
  /** Ask for customer name/phone when starting counter/takeaway/delivery
   * orders on /kot. Default false = skip straight to the menu. */
  ask_customer_details: boolean;
  /** Weekly hours: outlet base + per-channel overrides. Missing = always open. */
  business_hours?: BusinessHours;
  /** UPI VPAs for bill collect-QR (Print Studio). Exactly one may be default. */
  upi_ids: UpiAccount[];
  /** @deprecated single-VPA era; migrated into upi_ids on read. */
  upi_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OutletPayload = Partial<Outlet>;

/** One weekday's hours (day: 0 = Sunday). close <= open spans midnight. */
export type DayHours = {
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

export type OrderChannelKey = "dine_in" | "counter" | "takeaway" | "delivery" | "own_online";

/** Per-channel override: inherit the outlet base, or keep own week grid. */
export type ChannelHours = {
  use_outlet_hours: boolean;
  days?: DayHours[];
};

export type BusinessHours = {
  days: DayHours[];
  channels?: Partial<Record<OrderChannelKey, ChannelHours>>;
};

export type UpiAccount = {
  id: string;
  label: string;
  vpa: string;
  is_active: boolean;
  created_at: string;
};

/** Explicit default VPA, or null when none is active (QR disabled). */
export function activeUpiId(outlet: Pick<Outlet, "upi_ids" | "upi_id">): string | null {
  const hit = (outlet.upi_ids ?? []).find((u) => u.is_active);
  if (hit) return hit.vpa;
  if (outlet.upi_id) return outlet.upi_id;
  return null;
}

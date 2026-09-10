export type TableStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "cleaning"
  | "out_of_service";

export type TableShape =
  | "square"
  | "round"
  | "rectangle"
  | "triangle"
  | "ellipse"
  | "half_circle";

export type TableType =
  | "standard"
  | "bar_counter"
  | "communal"
  | "outdoor"
  | "private";

export type OccupancyStatus = "SEATED" | "ORDERING" | "RELEASED" | "CANCELLED";

export type OccupancyGroup = {
  id: string;
  table_id: string;
  outlet_id: string;
  floor_id: string;
  seats: number;
  order_id: string | null;
  status: OccupancyStatus;
  seated_at: string;
  released_at?: string;
  // Snapshots at seating time
  floor_name_snapshot?: string;
  table_number_snapshot?: string;
  table_code_snapshot?: string;
  capacity_at_seating?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  version: number;
};

export type TableBlock = {
  id: string;
  table_id: string;
  outlet_id: string;
  reason: string;
  blocked_at: string;
  blocked_by?: string;
  released_at?: string;
  created_at: string;
};

export type ReservationHoldStatus = "HELD" | "SEATED" | "EXPIRED" | "CANCELLED";

export type ReservationHold = {
  id: string;
  table_id: string;
  outlet_id: string;
  holder_name: string;
  holder_phone?: string;
  party_size: number;
  hold_from: string;
  hold_until: string;
  status: ReservationHoldStatus;
  created_at: string;
};

export type OccupancyFill = "EMPTY" | "PARTIAL" | "FULL";

export type RestaurantTable = {
  id: string;
  outlet_id: string;
  floor_id: string;
  floor_name?: string;
  number: string;
  code: string;
  capacity: number;
  shape: TableShape;
  type: TableType;
  allows_sharing: boolean;
  status: TableStatus; // Explicit state machine
  is_active: boolean;
  sort_order: number;
  // Layout (pose)
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rotation_deg: number;
  z_index: number;
  // Metadata
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type TableWithDerived = RestaurantTable & {
  occupancy_fill: OccupancyFill;
  seated_seats: number;
  active_groups: OccupancyGroup[];
  active_block?: TableBlock;
  active_hold?: ReservationHold;
  revenue_paise: number;
};

export type TablePayload = Partial<
  Omit<RestaurantTable, "id" | "created_at" | "updated_at" | "version" | "floor_name">
> &
  Pick<RestaurantTable, "floor_id" | "number" | "code" | "capacity">;

export type TableFilters = {
  search?: string;
  floor_id?: string;
  status?: TableStatus;
  is_active?: boolean;
  outlet_id?: string;
};

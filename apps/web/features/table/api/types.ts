export type TableStatus = "available" | "occupied" | "reserved" | "maintenance";

export type TableShape = "square" | "round" | "rectangle";

export type RestaurantTable = {
  id: string;
  outlet_id?: string;
  floor_id: string;
  floor_name?: string;
  number: string;
  code: string;
  capacity: number;
  shape: TableShape;
  status: TableStatus;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TablePayload = Partial<
  Omit<RestaurantTable, "id" | "created_at" | "updated_at" | "floor_name">
> &
  Pick<RestaurantTable, "floor_id" | "number" | "code" | "capacity">;

export type TableFilters = {
  search?: string;
  floor_id?: string;
  status?: TableStatus;
  is_active?: boolean;
};

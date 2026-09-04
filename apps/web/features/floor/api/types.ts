export type Floor = {
  id: string;
  outlet_id?: string;
  name: string;
  code: string;
  description?: string;
  level: number;
  capacity: number;
  sort_order: number;
  is_active: boolean;
  is_outdoor?: boolean;
  created_at: string;
  updated_at: string;
};

export type FloorPayload = Partial<Omit<Floor, "id" | "created_at" | "updated_at">> &
  Pick<Floor, "name" | "code">;

export type FloorFilters = {
  search?: string;
  is_active?: boolean;
};

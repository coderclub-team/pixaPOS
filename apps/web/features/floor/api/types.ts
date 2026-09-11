import type { RestaurantTable, TableWithDerived, OccupancyGroup } from "@/features/table/api/types";

export type Floor = {
  id: string;
  outlet_id: string;
  name: string;
  code: string;
  description?: string;
  level: number;
  capacity: number; // Headcount capacity
  sort_order: number;
  is_active: boolean;
  is_outdoor?: boolean;
  // Geometry
  width_mm: number;
  height_mm: number;
  grid_size_mm: number;
  background_color?: string;
  background_image_url?: string;
  // Metadata
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type FloorObjectKind = "wall" | "separator" | "bar" | "decor" | "label";

export type FloorObjectShape = "rect" | "pill" | "circle" | "ellipse" | "line";

export type FloorObject = {
  id: string;
  floor_id: string;
  outlet_id: string;
  kind: FloorObjectKind;
  shapeVariant?: FloorObjectShape;
  label?: string;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rotation_deg: number;
  z_index: number;
  color?: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type FloorLayout = {
  floor: Floor;
  tables: TableWithDerived[];
  groups: OccupancyGroup[];
  objects: FloorObject[];
};

export type FloorPayload = Partial<Omit<Floor, "id" | "created_at" | "updated_at" | "version">> &
  Pick<Floor, "name" | "code">;

export type FloorFilters = {
  search?: string;
  is_active?: boolean;
  outlet_id?: string;
};

export type ReorderFloorInput = {
  floor_id: string;
  sort_order: number;
};

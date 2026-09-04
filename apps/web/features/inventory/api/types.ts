export type RawMaterial = {
  id: string;
  outlet_id?: string;
  name: string;
  sku: string;
  category: string;
  unit: "kg" | "g" | "l" | "ml" | "pcs" | "box";
  stock_qty: number;
  low_stock_threshold: number;
  cost_price: number;
  avg_cost: number;
  supplier_id?: string;
  supplier_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderStatus = "draft" | "sent" | "received" | "cancelled";

export type PurchaseOrderItem = {
  material_id: string;
  material_name?: string;
  qty: number;
  unit_cost: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  items: PurchaseOrderItem[];
  total_amount: number;
  status: PurchaseOrderStatus;
  expected_at?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  material_id: string;
  material_name?: string;
  qty: number;
  unit: string;
  wastage_percent?: number;
};

export type Recipe = {
  id: string;
  name: string;
  yields: number;
  ingredients: RecipeIngredient[];
  cost_per_serve: number;
  selling_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WasteReason =
  | "spoilage"
  | "expired"
  | "overproduction"
  | "trimming"
  | "spillage"
  | "other";

export type WasteLog = {
  id: string;
  material_id?: string;
  material_name?: string;
  recipe_id?: string;
  qty: number;
  unit: string;
  reason: WasteReason;
  notes?: string;
  cost_loss: number;
  created_at: string;
};

export type StockTransactionType = "purchase" | "waste" | "adjustment" | "recipe_consumption";

export type StockLedgerEntry = {
  id: string;
  material_id: string;
  material_name?: string;
  type: StockTransactionType;
  qty_delta: number;
  reason?: string;
  reference_id?: string;
  previous_qty: number;
  new_qty: number;
  created_at: string;
  created_by?: string;
};

// Payloads
export type RawMaterialPayload = Partial<
  Omit<RawMaterial, "id" | "created_at" | "updated_at" | "avg_cost" | "supplier_name">
> &
  Pick<RawMaterial, "name" | "sku">;
export type SupplierPayload = Partial<Omit<Supplier, "id" | "created_at" | "updated_at">> &
  Pick<Supplier, "name" | "phone">;
export type PurchaseOrderPayload = Partial<
  Omit<
    PurchaseOrder,
    "id" | "created_at" | "updated_at" | "po_number" | "total_amount" | "supplier_name"
  >
> &
  Pick<PurchaseOrder, "supplier_id" | "items">;
export type RecipePayload = Partial<
  Omit<Recipe, "id" | "created_at" | "updated_at" | "cost_per_serve">
> &
  Pick<Recipe, "name" | "ingredients">;
export type WastePayload = Partial<
  Omit<WasteLog, "id" | "created_at" | "cost_loss" | "material_name">
> &
  Pick<WasteLog, "qty" | "reason">;

// Filters
export type RawMaterialFilters = {
  search?: string;
  category?: string;
  supplier_id?: string;
  low_stock?: boolean;
};
export type SupplierFilters = { search?: string; is_active?: boolean };
export type WasteFilters = { search?: string; reason?: WasteReason };

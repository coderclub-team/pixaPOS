export type MaterialSupplierPrice = {
  supplier_id: string;
  supplier_name?: string;
  last_rate: number;
  is_preferred?: boolean;
  last_purchase_at?: string;
};

export type RawMaterial = {
  id: string;
  outlet_id?: string;
  name: string;
  sku: string;
  category: string;
  unit: "kg" | "g" | "l" | "ml" | "pcs" | "box";
  stock_qty: number;
  low_stock_threshold: number; // simple threshold for reorder alerts
  opening_stock?: number;
  cost_price: number; // last purchase price — also used as transfer price
  avg_cost: number;
  tax_type?: "GST" | "VAT";
  tax_percent?: number;
  hsn_code?: string;
  barcode?: string;
  supplier_id?: string; // legacy single, use suppliers array for multi
  supplier_name?: string;
  suppliers?: MaterialSupplierPrice[]; // multi-vendor pricing (different vendors, different rates)
  is_active: boolean;
  is_expiry?: boolean;
  allow_decimal?: boolean;
  exclusive?: boolean;
  normal_loss_percent?: number;
  description?: string;
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
  tax_percent?: number;
  unit?: string;
  line_total?: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: string; // e.g., PO-2025-001, international standard
  supplier_id: string;
  supplier_name?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: PurchaseOrderStatus;
  po_date: string; // order date ISO YYYY-MM-DD
  expected_at?: string; // Delivery date
  reference?: string;
  payment_date?: string; // ISO YYYY-MM-DD, default today — informational only, NOT authoritative; source of truth is Purchase.payment_status + Payments (Purchase Bill)
  received_at?: string;
  sent_at?: string;
  sent_via?: "whatsapp" | "email" | "both";
  sent_to?: string;
  notes?: string;
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
  unit_cost?: number;
  total_cost?: number;
  avg_cost_before?: number;
  avg_cost_after?: number;
  created_at: string;
  created_by?: string;
};

export type MaterialPriceHistory = {
  id: string;
  material_id: string;
  material_name?: string;
  old_avg: number;
  new_avg: number;
  unit_cost: number;
  qty: number;
  old_stock: number;
  new_stock: number;
  source: "po_receive" | "purchase" | "manual_edit";
  reference_id?: string;
  created_at: string;
  created_by?: string;
};

export type PurchaseItem = {
  material_id: string;
  material_name?: string;
  qty: number;
  unit_cost: number;
  tax_percent?: number;
  line_total?: number;
};

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";
export type Purchase = {
  id: string;
  purchase_number: string; // PUR-YYYY-NNN
  po_id?: string | null;
  po_number?: string;
  supplier_id: string;
  supplier_name?: string;
  items: PurchaseItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: PurchasePaymentStatus;
  payment_mode?: "cash" | "upi" | "bank" | "credit";
  bill_date: string;
  due_date?: string;
  reference?: string; // vendor invoice number
  notes?: string;
  created_at: string;
  updated_at: string;
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
    | "id"
    | "created_at"
    | "updated_at"
    | "po_number"
    | "subtotal"
    | "tax_amount"
    | "total_amount"
    | "supplier_name"
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
export type PurchasePayload = Partial<
  Omit<
    Purchase,
    | "id"
    | "created_at"
    | "updated_at"
    | "purchase_number"
    | "supplier_name"
    | "subtotal"
    | "tax_amount"
    | "total_amount"
    | "payment_status"
  >
> &
  Pick<Purchase, "supplier_id" | "items" | "bill_date">;

// Filters
export type RawMaterialFilters = {
  search?: string;
  category?: string;
  supplier_id?: string;
  low_stock?: boolean;
};
export type SupplierFilters = { search?: string; is_active?: boolean };
export type PurchaseOrderFilters = { search?: string; status?: PurchaseOrderStatus };
export type PurchaseFilters = {
  search?: string;
  supplier_id?: string;
  payment_status?: PurchasePaymentStatus;
};
export type WasteFilters = { search?: string; reason?: WasteReason };

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
  unit: "kg" | "g" | "l" | "ml" | "pcs" | "box"; // base (stock) unit — recipes, ledger, costing
  purchase_unit?: "kg" | "g" | "l" | "ml" | "pcs" | "box"; // buying unit (Odoo purchase UoM)
  purchase_to_base_rate?: number; // 1 purchase_unit = X base units (e.g. 1 box = 12 pcs)
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
  qty: number; // base-unit qty (authoritative for stock/costing)
  unit_cost: number; // per base unit
  tax_percent?: number;
  unit?: string;
  line_total?: number;
  purchase_qty?: number; // as-bought qty (audit, e.g. 2 boxes)
  purchase_unit?: string; // as-bought unit
  purchase_unit_cost?: number; // price per purchase unit
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

export type RecipeVariantQty = {
  variant_id: string; // MenuItemVariant.id
  variant_name: string; // denormalized label (Small / Half)
  qty: number;
};

export type RecipeIngredient = {
  material_id: string;
  material_name?: string;
  qty: number; // base qty = simple-dish qty + fallback for variants without override (Odoo blank = all)
  unit: string;
  wastage_percent?: number;
  step_no?: number; // which method step consumes it (Odoo consumed-in-operation lite)
  variant_qtys?: RecipeVariantQty[]; // per-variant overrides, only when linked dish has variants
};

export type RecipeVessel =
  | "kadai"
  | "handi"
  | "tawa"
  | "pressure_cooker"
  | "oven"
  | "tandoor"
  | "steamer"
  | "wok"
  | "pan"
  | "pot"
  | "grill"
  | "fryer"
  | "other";
export type HeatLevel = "low" | "medium" | "high";
export type RecipeYieldUnit = "serves" | "plates" | "kg" | "l" | "pcs";

export type RecipeStep = {
  id: string;
  step_no: number;
  instruction: string;
  vessel?: RecipeVessel;
  vessel_note?: string; // when vessel === other, or extra detail
  temperature_c?: number; // 0-300, Celsius only
  heat_level?: HeatLevel;
  duration_min?: number;
  image_url?: string; // optional step photo (same FileUploader pattern as menu gallery)
  is_optional?: boolean;
};

export type RecipeVariantCost = { variant_id: string; variant_name: string; cost: number };

export type Recipe = {
  id: string;
  name: string;
  yields: number;
  yield_unit?: RecipeYieldUnit;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  cost_per_serve: number; // base/simple-dish cost
  cost_per_variant?: RecipeVariantCost[]; // derived on read, not stored
  selling_price?: number;
  prep_time_min?: number;
  cook_time_min?: number;
  plating_notes?: string;
  garnish?: string;
  serving_vessel?: string;
  menu_item_id?: string; // back-link to menu item (variant link lives on MenuItemVariant.recipe_id)
  photo_url?: string;
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
  | "order_cancelled"
  | "other";

export type WasteLog = {
  id: string;
  material_id?: string;
  material_name?: string;
  recipe_id?: string;
  recipe_name?: string;
  variant_id?: string;
  variant_name?: string;
  order_id?: string;
  order_number?: string;
  qty: number;
  unit: string;
  reason: WasteReason;
  notes?: string;
  photo_url?: string;
  cost_loss: number;
  created_by?: string;
  created_at: string;
};

export type CancelledOrderLine = {
  variant_id?: string;
  variant_name?: string;
  recipe_id: string;
  servings: number; // how many serves were already prepared
};

export type CancelledOrderWasteInput = {
  order_id: string;
  order_number?: string;
  created_by?: string;
  lines: CancelledOrderLine[]; // only kitchen-consumed (PREPARING+) lines — caller enforces
};

export type CancelledOrderWasteResult = {
  logs: WasteLog[];
  total_cost_loss: number;
  skipped: { recipe_id: string; reason: string }[];
};

export type StockTransactionType =
  | "purchase"
  | "purchase_return"
  | "waste"
  | "adjustment"
  | "recipe_consumption";

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
  location_id?: string; // e.g., main, kitchen, waste — Odoo location
  lot_number?: string; // batch for expiry trace
  supplier_name?: string;
  expiry_date?: string;
  landed_share?: number; // per-line landed amount
  created_at: string;
  created_by?: string;
};

export type StockLedgerFilters = {
  search?: string;
  material_id?: string;
  type?: StockTransactionType;
  date_from?: string;
  date_to?: string;
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
  source: "po_receive" | "purchase" | "purchase_return" | "manual_edit";
  reference_id?: string;
  created_at: string;
  created_by?: string;
};

export type PurchaseItem = {
  material_id: string;
  material_name?: string;
  qty: number; // base-unit qty (authoritative for stock/costing)
  unit_cost: number; // per base unit
  tax_percent?: number;
  line_total?: number;
  purchase_qty?: number; // as-bought qty (audit)
  purchase_unit?: string; // as-bought unit
  purchase_unit_cost?: number; // price per purchase unit
};

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";
export type LandedCostLabel = "Freight" | "Handling Charge" | "Tip" | "Packing" | "Other";
export type LandedCostLine = {
  label: LandedCostLabel;
  amount: number;
  custom_label?: string; // when label === Other
};
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
  landed_cost: number; // sum of landed_costs — additional cost (freight/handling/tip etc)
  landed_costs?: LandedCostLine[]; // breakdown, extendable — multiple lines, other charges
  total_amount: number; // subtotal + tax + landed
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
  Pick<Recipe, "name" | "ingredients"> & {
    steps?: Partial<RecipeStep>[];
  };
export type RecipeFilters = { search?: string; is_active?: boolean };
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
    | "landed_cost"
    | "landed_costs"
    | "total_amount"
    | "payment_status"
  >
> &
  Pick<Purchase, "supplier_id" | "items" | "bill_date"> & {
    landed_cost?: number;
    landed_costs?: LandedCostLine[];
  };

export type ReturnReason =
  | "damaged"
  | "expired"
  | "short_supply"
  | "wrong_item"
  | "quality"
  | "other";
export type ReturnStatus = "draft" | "approved" | "cancelled";
export type PurchaseReturnItem = {
  material_id: string;
  material_name?: string;
  qty_returned: number;
  qty_original: number;
  unit_cost: number;
  tax_percent?: number;
  line_refund?: number;
};
export type PurchaseReturn = {
  id: string;
  return_number: string; // RET-YYYY-NNN printed as Credit Note
  purchase_id: string;
  purchase_number?: string;
  po_id?: string | null;
  supplier_id: string;
  supplier_name?: string;
  items: PurchaseReturnItem[];
  subtotal_refund: number;
  tax_refund: number;
  total_refund: number;
  reason: ReturnReason;
  notes?: string;
  restock: boolean;
  status: ReturnStatus;
  bill_date: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
};
export type PurchaseReturnPayload = Partial<
  Omit<
    PurchaseReturn,
    | "id"
    | "created_at"
    | "updated_at"
    | "return_number"
    | "supplier_name"
    | "purchase_number"
    | "subtotal_refund"
    | "tax_refund"
    | "total_refund"
    | "status"
    | "approved_at"
  >
> &
  Pick<PurchaseReturn, "purchase_id" | "items" | "reason">;
export type PurchaseReturnFilters = {
  search?: string;
  supplier_id?: string;
  status?: ReturnStatus;
  purchase_id?: string;
};

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
export type WasteFilters = { search?: string; reason?: WasteReason; order_id?: string };
export type PurchaseReturnFiltersLegacy = PurchaseReturnFilters;

export type AdjustmentType = "credit" | "debit";
export type AdjustmentCategory =
  | "rate_difference"
  | "discount"
  | "shortage"
  | "freight"
  | "tax_correction"
  | "opening_balance"
  | "other";
export type AdjustmentStatus = "draft" | "posted" | "cancelled" | "applied";
export type SupplierAdjustment = {
  id: string;
  adjustment_number: string; // CN-SUP-YYYY-NNN or DN-SUP-YYYY-NNN
  type: AdjustmentType;
  supplier_id: string;
  supplier_name?: string;
  purchase_id?: string | null;
  purchase_number?: string;
  category: AdjustmentCategory;
  reference?: string;
  notes?: string;
  amount: number; // total including tax — entered or sum of items
  tax_amount?: number;
  subtotal?: number;
  items?: PurchaseReturnItem[]; // optional line audit, same shape as return items when item-linked
  bill_date: string;
  status: AdjustmentStatus;
  created_at: string;
  updated_at: string;
  posted_at?: string;
  applied_amount?: number;
};
export type SupplierAdjustmentPayload = Partial<
  Omit<
    SupplierAdjustment,
    | "id"
    | "created_at"
    | "updated_at"
    | "adjustment_number"
    | "supplier_name"
    | "purchase_number"
    | "status"
    | "posted_at"
  >
> &
  Pick<SupplierAdjustment, "supplier_id" | "type" | "category" | "amount" | "bill_date">;
export type SupplierAdjustmentFilters = {
  search?: string;
  supplier_id?: string;
  type?: AdjustmentType;
  status?: AdjustmentStatus;
  category?: AdjustmentCategory;
};

export type SupplierLedgerType = "purchase" | "payment" | "credit" | "debit" | "return";
export type SupplierLedgerEntry = {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  type: SupplierLedgerType;
  amount: number; // +payable for purchase/debit, -payable for payment/credit/return
  balance_after: number;
  reference_id?: string;
  reference_number?: string;
  reason?: string;
  bill_date: string;
  created_at: string;
};
export type SupplierLedgerFilters = {
  supplier_id?: string;
  type?: SupplierLedgerType;
  search?: string;
};

export type PaymentMode = "cash" | "upi" | "bank" | "credit";
export type PaymentStatus = "posted" | "cancelled";
export type SupplierPayment = {
  id: string;
  payment_number: string; // PAY-YYYY-NNN
  supplier_id: string;
  supplier_name?: string;
  purchase_id?: string | null;
  purchase_number?: string;
  amount: number;
  payment_mode: PaymentMode;
  bill_date: string;
  reference?: string;
  notes?: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};
export type SupplierPaymentPayload = Partial<
  Omit<
    SupplierPayment,
    | "id"
    | "created_at"
    | "updated_at"
    | "payment_number"
    | "supplier_name"
    | "purchase_number"
    | "status"
  >
> &
  Pick<SupplierPayment, "supplier_id" | "amount" | "bill_date">;
export type PaymentFilters = {
  search?: string;
  supplier_id?: string;
  purchase_id?: string;
  status?: PaymentStatus;
  payment_mode?: PaymentMode;
};

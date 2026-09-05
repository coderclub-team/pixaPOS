import { delay } from "@/constants/mock-api";
import type {
  RawMaterial,
  RawMaterialFilters,
  RawMaterialPayload,
  Recipe,
  RecipePayload,
  Supplier,
  SupplierFilters,
  SupplierPayload,
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseOrderStatus,
  WasteLog,
  WastePayload,
  WasteFilters,
  StockLedgerEntry,
  MaterialPriceHistory,
  Purchase,
  PurchasePayload,
  PurchaseFilters,
  PurchasePaymentStatus,
} from "./types";

// Raw Materials - Petpooja-aligned with multi-supplier
let mockRawMaterials: RawMaterial[] = [
  {
    id: "rm_001",
    outlet_id: "out_001",
    name: "Basmati Rice",
    sku: "RM-RICE-001",
    category: "Grains",
    unit: "kg",
    stock_qty: 45,
    low_stock_threshold: 20,
    opening_stock: 50,
    cost_price: 80,
    avg_cost: 78,
    tax_type: "GST",
    tax_percent: 5,
    hsn_code: "10063010",
    barcode: "8901234567890",
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    suppliers: [
      {
        supplier_id: "sup_001",
        supplier_name: "Shree Grains",
        last_rate: 78,
        is_preferred: true,
        last_purchase_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      },
      {
        supplier_id: "sup_003",
        supplier_name: "Oil Traders",
        last_rate: 82,
        is_preferred: false,
        last_purchase_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      },
    ],
    is_active: true,
    is_expiry: false,
    allow_decimal: true,
    exclusive: false,
    normal_loss_percent: 2,
    description: "Premium basmati for biryani",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rm_002",
    outlet_id: "out_001",
    name: "Chicken Breast",
    sku: "RM-CHKN-001",
    category: "Meat",
    unit: "kg",
    stock_qty: 8,
    low_stock_threshold: 10,
    opening_stock: 15,
    cost_price: 320,
    avg_cost: 310,
    tax_type: "GST",
    tax_percent: 5,
    hsn_code: "02071100",
    barcode: "8901234567891",
    supplier_id: "sup_002",
    supplier_name: "Fresh Meat Co",
    suppliers: [
      {
        supplier_id: "sup_002",
        supplier_name: "Fresh Meat Co",
        last_rate: 310,
        is_preferred: true,
      },
    ],
    is_active: true,
    is_expiry: true,
    allow_decimal: true,
    exclusive: false,
    normal_loss_percent: 5,
    description: "Fresh boneless chicken",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rm_003",
    outlet_id: "out_001",
    name: "Tomato",
    sku: "RM-VEG-001",
    category: "Vegetables",
    unit: "kg",
    stock_qty: 15,
    low_stock_threshold: 5,
    opening_stock: 20,
    cost_price: 30,
    avg_cost: 28,
    tax_type: "GST",
    tax_percent: 5,
    hsn_code: "07020000",
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    suppliers: [
      { supplier_id: "sup_001", supplier_name: "Shree Grains", last_rate: 28, is_preferred: true },
    ],
    is_active: true,
    is_expiry: true,
    allow_decimal: true,
    normal_loss_percent: 3,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rm_004",
    outlet_id: "out_001",
    name: "Cooking Oil",
    sku: "RM-OIL-001",
    category: "Oil",
    unit: "l",
    stock_qty: 25,
    low_stock_threshold: 10,
    opening_stock: 30,
    cost_price: 140,
    avg_cost: 135,
    tax_type: "GST",
    tax_percent: 5,
    hsn_code: "15121910",
    barcode: "8901234567892",
    supplier_id: "sup_003",
    supplier_name: "Oil Traders",
    suppliers: [
      { supplier_id: "sup_003", supplier_name: "Oil Traders", last_rate: 135, is_preferred: true },
    ],
    is_active: true,
    is_expiry: false,
    allow_decimal: true,
    exclusive: false,
    normal_loss_percent: 1,
    description: "Refined sunflower oil 15L tin",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockSuppliers: Supplier[] = [
  {
    id: "sup_001",
    name: "Shree Grains",
    contact_person: "Ramesh Patel",
    phone: "9876543001",
    email: "shree@supplier.com",
    gstin: "24ABCDE1234F1Z5",
    address: "APMC Market, Ahmedabad",
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sup_002",
    name: "Fresh Meat Co",
    contact_person: "Arjun Singh",
    phone: "9876543002",
    email: "fresh@meat.com",
    address: "Meat Market, Ahmedabad",
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sup_003",
    name: "Oil Traders",
    contact_person: "Suresh Kumar",
    phone: "9876543003",
    email: "oil@traders.com",
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockRecipes: Recipe[] = [
  {
    id: "rec_001",
    name: "Chicken Biryani",
    yields: 1,
    ingredients: [
      {
        material_id: "rm_001",
        material_name: "Basmati Rice",
        qty: 0.2,
        unit: "kg",
        wastage_percent: 2,
      },
      {
        material_id: "rm_002",
        material_name: "Chicken Breast",
        qty: 0.25,
        unit: "kg",
        wastage_percent: 5,
      },
      { material_id: "rm_004", material_name: "Cooking Oil", qty: 0.05, unit: "l" },
    ],
    cost_per_serve: 110,
    selling_price: 299,
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec_002",
    name: "Veg Pulao",
    yields: 1,
    ingredients: [
      { material_id: "rm_001", material_name: "Basmati Rice", qty: 0.2, unit: "kg" },
      { material_id: "rm_003", material_name: "Tomato", qty: 0.1, unit: "kg" },
      { material_id: "rm_004", material_name: "Cooking Oil", qty: 0.03, unit: "l" },
    ],
    cost_per_serve: 45,
    selling_price: 199,
    is_active: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockWaste: WasteLog[] = [
  {
    id: "wst_001",
    material_id: "rm_003",
    material_name: "Tomato",
    qty: 2,
    unit: "kg",
    reason: "spoilage",
    notes: "Overripe, not usable",
    cost_loss: 56,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "wst_002",
    material_id: "rm_002",
    material_name: "Chicken Breast",
    qty: 1,
    unit: "kg",
    reason: "expired",
    notes: "Cold storage failure",
    cost_loss: 310,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
];

let mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po_001",
    po_number: "PO-2024-001",
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    items: [
      {
        material_id: "rm_001",
        material_name: "Basmati Rice",
        qty: 50,
        unit_cost: 78,
        tax_percent: 5,
        unit: "kg",
        line_total: 3900,
      },
      {
        material_id: "rm_003",
        material_name: "Tomato",
        qty: 20,
        unit_cost: 28,
        tax_percent: 5,
        unit: "kg",
        line_total: 560,
      },
    ],
    subtotal: 4460,
    tax_amount: 223,
    total_amount: 4683,
    status: "received",
    po_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10),
    expected_at: new Date().toISOString().slice(0, 10),
    reference: "IND-001",
    payment_date: new Date().toISOString().slice(0, 10),
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "po_002",
    po_number: "PO-2024-002",
    supplier_id: "sup_002",
    supplier_name: "Fresh Meat Co",
    items: [
      {
        material_id: "rm_002",
        material_name: "Chicken Breast",
        qty: 20,
        unit_cost: 310,
        tax_percent: 5,
        unit: "kg",
        line_total: 6200,
      },
    ],
    subtotal: 6200,
    tax_amount: 310,
    total_amount: 6510,
    status: "sent",
    po_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString().slice(0, 10),
    expected_at: new Date().toISOString().slice(0, 10),
    payment_date: new Date().toISOString().slice(0, 10),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    updated_at: new Date().toISOString(),
  },
];
const PO_STORAGE_KEY = "pixaPOs";
function savePOs() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PO_STORAGE_KEY, JSON.stringify(mockPurchaseOrders));
    } catch {}
  }
}
function loadPOs(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(PO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          mockPurchaseOrders = parsed;
        }
      }
    } catch {}
  }
}
// hydrate from storage on browser init
loadPOs();

let mockStockLedger: StockLedgerEntry[] = [
  {
    id: "stk_001",
    material_id: "rm_001",
    material_name: "Basmati Rice",
    type: "purchase",
    qty_delta: 50,
    reason: "PO-2024-001",
    reference_id: "po_001",
    previous_qty: 0,
    new_qty: 50,
    unit_cost: 78,
    total_cost: 3900,
    avg_cost_before: 0,
    avg_cost_after: 78,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "stk_002",
    material_id: "rm_003",
    material_name: "Tomato",
    type: "waste",
    qty_delta: -2,
    reason: "spoilage",
    reference_id: "wst_001",
    previous_qty: 17,
    new_qty: 15,
    unit_cost: 28,
    total_cost: 56,
    avg_cost_before: 28,
    avg_cost_after: 28,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
];

let mockPriceHistory: MaterialPriceHistory[] = [
  {
    id: "ph_001",
    material_id: "rm_001",
    material_name: "Basmati Rice",
    old_avg: 0,
    new_avg: 78,
    unit_cost: 78,
    qty: 50,
    old_stock: 0,
    new_stock: 50,
    source: "po_receive",
    reference_id: "po_001",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

// Helpers
const supplierNameMap = () => Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
const materialMap = () => Object.fromEntries(mockRawMaterials.map((m) => [m.id, m]));

function recalculateRecipeCosts() {
  const materials = materialMap();
  mockRecipes.forEach((recipe) => {
    let cost = 0;
    recipe.ingredients.forEach((ing) => {
      const mat = materials[ing.material_id];
      cost += ing.qty * (mat?.avg_cost ?? 0) * (1 + (ing.wastage_percent ?? 0) / 100);
    });
    recipe.cost_per_serve = Math.round(cost * 100) / 100;
    recipe.updated_at = new Date().toISOString();
  });
}

// Raw Materials CRUD
export async function getRawMaterials(filters?: RawMaterialFilters): Promise<RawMaterial[]> {
  await delay(400);
  let result = [...mockRawMaterials].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q),
    );
  }
  if (filters?.category) result = result.filter((m) => m.category === filters.category);
  if (filters?.supplier_id) result = result.filter((m) => m.supplier_id === filters.supplier_id);
  if (filters?.low_stock) result = result.filter((m) => m.stock_qty <= m.low_stock_threshold);
  return result;
}

export async function getRawMaterialById(id: string): Promise<RawMaterial | null> {
  await delay(300);
  return mockRawMaterials.find((m) => m.id === id) ?? null;
}

export async function createRawMaterial(payload: RawMaterialPayload): Promise<RawMaterial> {
  await delay(600);
  if (mockRawMaterials.some((m) => m.sku.toLowerCase() === payload.sku.toLowerCase()))
    throw new Error(`SKU "${payload.sku}" already exists`);
  if (payload.barcode && mockRawMaterials.some((m) => m.barcode && m.barcode === payload.barcode))
    throw new Error(`Barcode "${payload.barcode}" already exists`);
  if (payload.hsn_code && !/^[0-9]{4,8}$/.test(payload.hsn_code))
    throw new Error("Invalid HSN 4-8 digits");
  const now = new Date().toISOString();
  const supplierMap = supplierNameMap();
  const suppliers = (payload as any).suppliers as RawMaterial["suppliers"] | undefined;
  const enrichedSuppliers =
    suppliers?.map((s) => ({
      ...s,
      supplier_name: supplierMap[s.supplier_id] ?? s.supplier_name,
    })) ?? undefined;
  const mat: RawMaterial = {
    id: `rm_${Date.now().toString(36)}`,
    outlet_id: "out_001",
    name: payload.name,
    sku: payload.sku.toUpperCase(),
    category: payload.category ?? "General",
    unit: payload.unit ?? "pcs",
    stock_qty: payload.stock_qty ?? 0,
    low_stock_threshold: payload.low_stock_threshold ?? 5,
    opening_stock: (payload as any).opening_stock ?? payload.stock_qty ?? 0,
    cost_price: payload.cost_price ?? 0,
    avg_cost: payload.cost_price ?? 0,
    tax_type: (payload as any).tax_type,
    tax_percent: (payload as any).tax_percent,
    hsn_code: (payload as any).hsn_code,
    barcode: (payload as any).barcode,
    supplier_id: payload.supplier_id,
    supplier_name: payload.supplier_id ? supplierMap[payload.supplier_id] : undefined,
    suppliers: enrichedSuppliers,
    is_active: payload.is_active ?? true,
    is_expiry: (payload as any).is_expiry,
    allow_decimal: (payload as any).allow_decimal,
    exclusive: (payload as any).exclusive,
    normal_loss_percent: (payload as any).normal_loss_percent,
    description: (payload as any).description,
    created_at: now,
    updated_at: now,
  };
  mockRawMaterials.push(mat);
  return { ...mat };
}

export async function updateRawMaterial(
  id: string,
  payload: RawMaterialPayload,
): Promise<RawMaterial> {
  await delay(600);
  const idx = mockRawMaterials.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Raw material not found");
  if (
    payload.sku &&
    mockRawMaterials.some((m) => m.id !== id && m.sku.toLowerCase() === payload.sku!.toLowerCase())
  )
    throw new Error(`SKU "${payload.sku}" already exists`);
  if (
    (payload as any).barcode &&
    mockRawMaterials.some((m) => m.id !== id && m.barcode && m.barcode === (payload as any).barcode)
  )
    throw new Error(`Barcode "${(payload as any).barcode}" already exists`);
  const current = mockRawMaterials[idx];
  const supplierMap = supplierNameMap();
  const suppliers = (payload as any).suppliers as RawMaterial["suppliers"] | undefined;
  const enrichedSuppliers = suppliers
    ? suppliers.map((s) => ({ ...s, supplier_name: supplierMap[s.supplier_id] ?? s.supplier_name }))
    : undefined;
  const updated: RawMaterial = {
    ...current,
    ...payload,
    sku: payload.sku ? payload.sku.toUpperCase() : current.sku,
    supplier_name: payload.supplier_id ? supplierMap[payload.supplier_id] : current.supplier_name,
    suppliers: enrichedSuppliers ?? current.suppliers,
    updated_at: new Date().toISOString(),
  };
  // Track manual price edit history if cost_price changed without PO
  if (payload.cost_price !== undefined && payload.cost_price !== current.cost_price) {
    const oldAvg = current.avg_cost;
    // For manual edit, we keep avg as is but log history for audit
    mockPriceHistory.push({
      id: `ph_${Date.now().toString(36)}_${id}`,
      material_id: id,
      material_name: current.name,
      old_avg: oldAvg,
      new_avg: oldAvg,
      unit_cost: payload.cost_price,
      qty: 0,
      old_stock: current.stock_qty,
      new_stock: current.stock_qty,
      source: "manual_edit",
      reference_id: id,
      created_at: new Date().toISOString(),
    });
  }
  mockRawMaterials[idx] = updated;
  return { ...updated };
}

export async function deleteRawMaterial(id: string): Promise<void> {
  await delay(500);
  const idx = mockRawMaterials.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Raw material not found");
  mockRawMaterials.splice(idx, 1);
}

// Suppliers
export async function getSuppliers(filters?: SupplierFilters): Promise<Supplier[]> {
  await delay(400);
  let result = [...mockSuppliers].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((s) => s.name.toLowerCase().includes(q) || s.phone.includes(q));
  }
  if (filters?.is_active !== undefined)
    result = result.filter((s) => s.is_active === filters.is_active);
  return result;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  await delay(300);
  return mockSuppliers.find((s) => s.id === id) ?? null;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  await delay(600);
  if (mockSuppliers.some((s) => s.phone === payload.phone))
    throw new Error(`Phone "${payload.phone}" already exists`);
  const now = new Date().toISOString();
  const sup: Supplier = {
    id: `sup_${Date.now().toString(36)}`,
    name: payload.name,
    contact_person: payload.contact_person,
    phone: payload.phone,
    email: payload.email,
    gstin: payload.gstin,
    address: payload.address,
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockSuppliers.push(sup);
  return { ...sup };
}

export async function updateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  await delay(600);
  const idx = mockSuppliers.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Supplier not found");
  const updated = { ...mockSuppliers[idx], ...payload, updated_at: new Date().toISOString() };
  mockSuppliers[idx] = updated;
  return { ...updated };
}

export async function deleteSupplier(id: string): Promise<void> {
  await delay(500);
  const idx = mockSuppliers.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Supplier not found");
  mockSuppliers.splice(idx, 1);
}

// Recipes
export async function getRecipes(): Promise<Recipe[]> {
  await delay(400);
  return [...mockRecipes];
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  await delay(300);
  return mockRecipes.find((r) => r.id === id) ?? null;
}

export async function createRecipe(payload: RecipePayload): Promise<Recipe> {
  await delay(600);
  const materials = materialMap();
  let cost = 0;
  const ingredients = payload.ingredients.map((ing) => {
    const mat = materials[ing.material_id];
    const unitCost = mat?.avg_cost ?? 0;
    cost += ing.qty * unitCost * (1 + (ing.wastage_percent ?? 0) / 100);
    return { ...ing, material_name: mat?.name };
  });
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: `rec_${Date.now().toString(36)}`,
    name: payload.name,
    yields: payload.yields ?? 1,
    ingredients,
    cost_per_serve: Math.round(cost * 100) / 100,
    selling_price: payload.selling_price,
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockRecipes.push(recipe);
  return { ...recipe };
}

export async function updateRecipe(id: string, payload: RecipePayload): Promise<Recipe> {
  await delay(600);
  const idx = mockRecipes.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Recipe not found");
  const materials = materialMap();
  const ingredients = (payload.ingredients ?? mockRecipes[idx].ingredients).map((ing) => ({
    ...ing,
    material_name: materials[ing.material_id]?.name ?? ing.material_name,
  }));
  let cost = 0;
  ingredients.forEach((ing) => {
    const mat = materials[ing.material_id];
    cost += ing.qty * (mat?.avg_cost ?? 0) * (1 + (ing.wastage_percent ?? 0) / 100);
  });
  const updated: Recipe = {
    ...mockRecipes[idx],
    ...payload,
    ingredients,
    cost_per_serve: Math.round(cost * 100) / 100,
    updated_at: new Date().toISOString(),
  };
  mockRecipes[idx] = updated;
  return { ...updated };
}

export async function deleteRecipe(id: string): Promise<void> {
  await delay(500);
  const idx = mockRecipes.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Recipe not found");
  mockRecipes.splice(idx, 1);
}

// Purchase Orders
export async function getPurchaseOrders(
  filters?: import("./types").PurchaseOrderFilters,
): Promise<PurchaseOrder[]> {
  await delay(400);
  let result = [...mockPurchaseOrders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.po_number.toLowerCase().includes(q) ||
        (p.supplier_name ?? "").toLowerCase().includes(q) ||
        p.items.some((it) => (it.material_name ?? "").toLowerCase().includes(q)),
    );
  }
  if (filters?.status) result = result.filter((p) => p.status === filters.status);
  return result;
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  await delay(300);
  let found = mockPurchaseOrders.find((p) => p.id === id) ?? null;
  if (!found && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(PO_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as PurchaseOrder[];
        found = arr.find((p) => p.id === id) ?? null;
        if (found) {
          // hydrate in-memory for next calls
          if (!mockPurchaseOrders.some((p) => p.id === id)) mockPurchaseOrders.push(found);
        }
      }
    } catch {}
  }
  return found;
}

function computePOTotals(items: PurchaseOrder["items"]): {
  subtotal: number;
  tax_amount: number;
  total_amount: number;
} {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
  const tax_amount =
    Math.round(
      items.reduce((s, it) => s + it.qty * it.unit_cost * ((it.tax_percent ?? 0) / 100), 0) * 100,
    ) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount,
    total_amount: Math.round((subtotal + tax_amount) * 100) / 100,
  };
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
  await delay(700);
  const supName = supplierNameMap()[payload.supplier_id] ?? payload.supplier_id;
  const materials = materialMap();
  const items = payload.items.map((it) => ({
    material_id: it.material_id,
    material_name: materials[it.material_id]?.name,
    qty: it.qty,
    unit_cost: it.unit_cost,
    tax_percent: (it as any).tax_percent ?? materials[it.material_id]?.tax_percent ?? 5,
    unit: materials[it.material_id]?.unit,
    line_total: Math.round(it.qty * it.unit_cost * 100) / 100,
  }));
  const { subtotal, tax_amount, total_amount } = computePOTotals(items as any);
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const existingForYear = mockPurchaseOrders
    .filter((p) => p.po_number.startsWith(`PO-${year}-`))
    .map((p) => parseInt(p.po_number.split("-")[2] ?? "0", 10))
    .filter((n) => !Number.isNaN(n));
  const nextNum = existingForYear.length > 0 ? Math.max(...existingForYear) + 1 : 1;
  const poDate = (payload as any).po_date ?? now.slice(0, 10);
  const expectedAt = payload.expected_at ?? poDate;
  const paymentDate = (payload as any).payment_date ?? now.slice(0, 10);
  const po: PurchaseOrder = {
    id: `po_${Date.now().toString(36)}`,
    po_number: `PO-${year}-${String(nextNum).padStart(3, "0")}`,
    supplier_id: payload.supplier_id,
    supplier_name: supName,
    items: items as any,
    subtotal,
    tax_amount,
    total_amount,
    status: "draft",
    po_date: poDate,
    expected_at: expectedAt,
    reference: (payload as any).reference,
    payment_date: paymentDate,
    notes: (payload as any).notes,
    created_at: now,
    updated_at: now,
  };
  mockPurchaseOrders.push(po);
  savePOs();
  return { ...po };
}

export function buildWhatsappUrl(supplier: Supplier, po: PurchaseOrder): string {
  const phone = supplier.phone.replace(/\D/g, "");
  const itemsText = po.items
    .map((it) => `• ${it.material_name ?? it.material_id} x${it.qty} @₹${it.unit_cost}`)
    .join("%0A");
  const text = `Hello ${supplier.name},%0APurchase Order ${po.po_number} from PixaPOS%0A%0A${itemsText}%0ATotal: ₹${po.total_amount}%0AExpected: ${po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "-"}%0APlease confirm.%0A%0APO ID: ${po.id}`;
  // wa.me requires full number with country code, assume +91 if 10 digits
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  return `https://wa.me/${waPhone}?text=${text}`;
}

export function buildEmailHtml(
  supplier: Supplier,
  po: PurchaseOrder,
): { subject: string; html: string } {
  const subject = `Purchase Order ${po.po_number} — ${supplier.name}`;
  const rows = po.items
    .map(
      (it) =>
        `<tr><td style="padding:8px;border:1px solid #ddd">${it.material_name ?? it.material_id}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${it.qty}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${it.unit_cost}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${it.qty * it.unit_cost}</td></tr>`,
    )
    .join("");
  const html = `<div style=\"font-family:sans-serif\"><h2>${subject}</h2><p>Dear ${supplier.name},</p><p>Please supply the following as per PO <b>${po.po_number}</b>:</p><table style=\"border-collapse:collapse;width:100%\"><thead><tr><th style=\"padding:8px;border:1px solid #ddd;text-align:left\">Material</th><th style=\"padding:8px;border:1px solid #ddd\">Qty</th><th style=\"padding:8px;border:1px solid #ddd\">Unit Cost</th><th style=\"padding:8px;border:1px solid #ddd\">Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan=\"3\" style=\"padding:8px;border:1px solid #ddd;text-align:right\"><b>Total</b></td><td style=\"padding:8px;border:1px solid #ddd;text-align:right\"><b>₹${po.total_amount}</b></td></tr></tfoot></table><p>Expected: ${po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "-"}<br/>Notes: ${po.notes ?? "-"}</p><p>PO ID: ${po.id}</p></div>`;
  return { subject, html };
}

export async function sendPurchaseOrderViaWhatsapp(
  id: string,
): Promise<{ url: string; po: PurchaseOrder }> {
  await delay(500);
  const po = mockPurchaseOrders.find((p) => p.id === id);
  if (!po) throw new Error("Purchase order not found");
  const supplier = mockSuppliers.find((s) => s.id === po.supplier_id);
  if (!supplier) throw new Error("Supplier not found");
  const url = buildWhatsappUrl(supplier, po);
  // Mark as sent if was draft, track sent_via
  const idx = mockPurchaseOrders.findIndex((p) => p.id === id);
  if (po.status === "draft") {
    mockPurchaseOrders[idx] = {
      ...po,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_via: po.sent_via === "email" ? "both" : "whatsapp",
      sent_to: supplier.phone,
      updated_at: new Date().toISOString(),
    };
  } else if (po.status === "sent" && po.sent_via !== "whatsapp" && po.sent_via !== "both") {
    mockPurchaseOrders[idx] = {
      ...po,
      sent_via: po.sent_via ? "both" : "whatsapp",
      sent_to: supplier.phone,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return { url, po: { ...mockPurchaseOrders[idx] } };
}

export async function sendPurchaseOrderViaEmail(
  id: string,
): Promise<{ subject: string; html: string; po: PurchaseOrder }> {
  await delay(800);
  const po = mockPurchaseOrders.find((p) => p.id === id);
  if (!po) throw new Error("Purchase order not found");
  const supplier = mockSuppliers.find((s) => s.id === po.supplier_id);
  if (!supplier) throw new Error("Supplier not found");
  if (!supplier.email) throw new Error("Supplier email not found");
  const { subject, html } = buildEmailHtml(supplier, po);
  // In production, here would be: await resend.emails.send({ from, to: supplier.email, subject, html });
  const idx = mockPurchaseOrders.findIndex((p) => p.id === id);
  if (po.status === "draft") {
    mockPurchaseOrders[idx] = {
      ...po,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_via: po.sent_via === "whatsapp" ? "both" : "email",
      sent_to: supplier.email,
      updated_at: new Date().toISOString(),
    };
  } else if (po.status === "sent" && po.sent_via !== "email" && po.sent_via !== "both") {
    mockPurchaseOrders[idx] = {
      ...po,
      sent_via: po.sent_via ? "both" : "email",
      sent_to: supplier.email,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return { subject, html, po: { ...mockPurchaseOrders[idx] } };
}

export async function updatePurchaseOrder(
  id: string,
  payload: Partial<
    PurchaseOrderPayload & {
      expected_at?: string;
      notes?: string;
      po_date?: string;
      reference?: string;
      payment_date?: string;
    }
  >,
): Promise<PurchaseOrder> {
  await delay(600);
  const idx = mockPurchaseOrders.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase order not found");
  const po = mockPurchaseOrders[idx];
  if (po.status === "received") throw new Error("Cannot edit received PO (GRN done)");
  if (po.status === "cancelled") throw new Error("Cannot edit cancelled PO");
  const materials = materialMap();
  let items = po.items;
  if (payload.items) {
    items = payload.items.map((it) => ({
      ...it,
      material_name: materials[it.material_id]?.name,
      tax_percent: (it as any).tax_percent ?? materials[it.material_id]?.tax_percent ?? 5,
      unit: materials[it.material_id]?.unit,
      line_total: Math.round(it.qty * it.unit_cost * 100) / 100,
    })) as any;
  }
  const { subtotal, tax_amount, total_amount } = computePOTotals(items as any);
  const updated: PurchaseOrder = {
    ...po,
    supplier_id: payload.supplier_id ?? po.supplier_id,
    supplier_name: payload.supplier_id
      ? (supplierNameMap()[payload.supplier_id] ?? po.supplier_name)
      : po.supplier_name,
    items: items as any,
    subtotal,
    tax_amount,
    total_amount,
    po_date: (payload as any).po_date ?? po.po_date,
    expected_at: payload.expected_at ?? po.expected_at,
    reference: (payload as any).reference ?? po.reference,
    payment_date: (payload as any).payment_date ?? (po as any).payment_date,
    notes: (payload as any).notes ?? po.notes,
    updated_at: new Date().toISOString(),
  };
  mockPurchaseOrders[idx] = updated;
  savePOs();
  return { ...updated };
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await delay(500);
  const idx = mockPurchaseOrders.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase order not found");
  const po = mockPurchaseOrders[idx];
  if (po.status === "received")
    throw new Error("Cannot delete received PO (GRN done) — cancel instead");
  mockPurchaseOrders.splice(idx, 1);
  savePOs();
}

export async function clonePurchaseOrder(id: string): Promise<PurchaseOrder> {
  await delay(600);
  const src = mockPurchaseOrders.find((p) => p.id === id);
  if (!src) throw new Error("Purchase order not found");
  const supName = supplierNameMap()[src.supplier_id] ?? src.supplier_name;
  const year = new Date().getFullYear();
  const existingForYear = mockPurchaseOrders
    .filter((p) => p.po_number.startsWith(`PO-${year}-`))
    .map((p) => parseInt(p.po_number.split("-")[2] ?? "0", 10))
    .filter((n) => !Number.isNaN(n));
  const nextNum = existingForYear.length > 0 ? Math.max(...existingForYear) + 1 : 1;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const cloned: PurchaseOrder = {
    ...src,
    id: `po_${Date.now().toString(36)}`,
    po_number: `PO-${year}-${String(nextNum).padStart(3, "0")}`,
    status: "draft",
    po_date: today,
    expected_at: today,
    payment_date: today,
    reference: undefined,
    received_at: undefined,
    sent_at: undefined,
    sent_via: undefined,
    sent_to: undefined,
    created_at: now,
    updated_at: now,
  };
  mockPurchaseOrders.push(cloned);
  savePOs();
  return { ...cloned };
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder> {
  await delay(500);
  const idx = mockPurchaseOrders.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase order not found");
  const po = mockPurchaseOrders[idx];
  const updated = {
    ...po,
    status,
    updated_at: new Date().toISOString(),
    received_at: status === "received" ? new Date().toISOString() : po.received_at,
  };
  // GRN only — stock/WAC now handled by Purchases (Purchase Bill). Keeping PO received as marker only.
  mockPurchaseOrders[idx] = updated;
  savePOs();
  return { ...updated };
}

// Purchases — Bill/Payable (GRN stock is via purchase, not PO)
let mockPurchases: Purchase[] = [
  {
    id: "pur_001",
    purchase_number: "PUR-2024-001",
    po_id: "po_001",
    po_number: "PO-2024-001",
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    items: [
      {
        material_id: "rm_001",
        material_name: "Basmati Rice",
        qty: 50,
        unit_cost: 78,
        tax_percent: 5,
        line_total: 3900,
      },
      {
        material_id: "rm_003",
        material_name: "Tomato",
        qty: 20,
        unit_cost: 28,
        tax_percent: 5,
        line_total: 560,
      },
    ],
    subtotal: 4460,
    tax_amount: 223,
    total_amount: 4683,
    paid_amount: 4683,
    payment_status: "paid",
    payment_mode: "bank",
    bill_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function computePurchaseTotals(items: Purchase["items"]): {
  subtotal: number;
  tax_amount: number;
  total_amount: number;
} {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
  const tax_amount =
    Math.round(
      items.reduce((s, it) => s + it.qty * it.unit_cost * ((it.tax_percent ?? 0) / 100), 0) * 100,
    ) / 100;
  const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax_amount, total_amount };
}
function derivePaymentStatus(total: number, paid: number): PurchasePaymentStatus {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}
function applyStockForPurchase(pur: Purchase) {
  pur.items.forEach((item) => {
    const matIdx = mockRawMaterials.findIndex((m) => m.id === item.material_id);
    if (matIdx === -1) return;
    const prev = mockRawMaterials[matIdx].stock_qty;
    const newQty = prev + item.qty;
    const oldAvg = mockRawMaterials[matIdx].avg_cost;
    const newAvg = newQty > 0 ? (oldAvg * prev + item.unit_cost * item.qty) / newQty : oldAvg;
    const roundedAvg = Math.round(newAvg * 100) / 100;
    mockRawMaterials[matIdx].stock_qty = newQty;
    mockRawMaterials[matIdx].avg_cost = roundedAvg;
    mockRawMaterials[matIdx].cost_price = item.unit_cost;
    mockRawMaterials[matIdx].updated_at = new Date().toISOString();
    mockStockLedger.push({
      id: `stk_${Date.now().toString(36)}_${item.material_id}`,
      material_id: item.material_id,
      material_name: mockRawMaterials[matIdx].name,
      type: "purchase",
      qty_delta: item.qty,
      reason: pur.purchase_number,
      reference_id: pur.id,
      previous_qty: prev,
      new_qty: newQty,
      unit_cost: item.unit_cost,
      total_cost: Math.round(item.unit_cost * item.qty * 100) / 100,
      avg_cost_before: oldAvg,
      avg_cost_after: roundedAvg,
      created_at: new Date().toISOString(),
    });
    mockPriceHistory.push({
      id: `ph_${Date.now().toString(36)}_${item.material_id}`,
      material_id: item.material_id,
      material_name: mockRawMaterials[matIdx].name,
      old_avg: oldAvg,
      new_avg: roundedAvg,
      unit_cost: item.unit_cost,
      qty: item.qty,
      old_stock: prev,
      new_stock: newQty,
      source: "purchase",
      reference_id: pur.id,
      created_at: new Date().toISOString(),
    });
  });
  recalculateRecipeCosts();
}

export async function getPurchases(filters?: PurchaseFilters): Promise<Purchase[]> {
  await delay(400);
  let result = [...mockPurchases].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.purchase_number.toLowerCase().includes(q) ||
        (p.supplier_name ?? "").toLowerCase().includes(q) ||
        (p.po_number ?? "").toLowerCase().includes(q),
    );
  }
  if (filters?.supplier_id) result = result.filter((p) => p.supplier_id === filters.supplier_id);
  if (filters?.payment_status)
    result = result.filter((p) => p.payment_status === filters.payment_status);
  return result;
}
export async function getPurchaseById(id: string): Promise<Purchase | null> {
  await delay(300);
  return mockPurchases.find((p) => p.id === id) ?? null;
}
export async function createPurchase(payload: PurchasePayload): Promise<Purchase> {
  await delay(700);
  const supName = supplierNameMap()[payload.supplier_id] ?? payload.supplier_id;
  const materials = materialMap();
  const po = payload.po_id ? mockPurchaseOrders.find((p) => p.id === payload.po_id) : null;
  if (payload.po_id && !po) throw new Error("Linked PO not found");
  // Odoo/Zoho: only sent POs can be billed, and only once (invoiced hidden)
  if (po) {
    if (po.status !== "sent")
      throw new Error("Only sent POs can be billed (Odoo: draft/received/cancelled not billable)");
    if (mockPurchases.some((p) => p.po_id === po.id))
      throw new Error(
        "PO already billed — duplicate purchase not allowed (Odoo: already invoiced)",
      );
  }
  const enriched = payload.items.map((it) => ({
    material_id: it.material_id,
    material_name: materials[it.material_id]?.name ?? it.material_id,
    qty: it.qty,
    unit_cost: it.unit_cost,
    tax_percent: (it as any).tax_percent ?? materials[it.material_id]?.tax_percent ?? 5,
    line_total: Math.round(it.qty * it.unit_cost * 100) / 100,
  }));
  const { subtotal, tax_amount, total_amount } = computePurchaseTotals(enriched as any);
  const paid = (payload as any).paid_amount ?? 0;
  if (paid < 0 || paid > total_amount) throw new Error("Paid amount must be 0..total");
  const year = new Date().getFullYear();
  const existingForYear = mockPurchases
    .filter((p) => p.purchase_number.startsWith(`PUR-${year}-`))
    .map((p) => parseInt(p.purchase_number.split("-")[2] ?? "0", 10))
    .filter((n) => !Number.isNaN(n));
  const nextNum = existingForYear.length > 0 ? Math.max(...existingForYear) + 1 : 1;
  const billDate = payload.bill_date ?? new Date().toISOString().slice(0, 10);
  const dueDate =
    (payload as any).due_date ??
    new Date(new Date(billDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const pur: Purchase = {
    id: `pur_${Date.now().toString(36)}`,
    purchase_number: `PUR-${year}-${String(nextNum).padStart(3, "0")}`,
    po_id: payload.po_id ?? null,
    po_number: po?.po_number,
    supplier_id: payload.supplier_id,
    supplier_name: supName,
    items: enriched as any,
    subtotal,
    tax_amount,
    total_amount,
    paid_amount: Math.round(paid * 100) / 100,
    payment_status: derivePaymentStatus(total_amount, paid),
    payment_mode: (payload as any).payment_mode,
    bill_date: billDate,
    due_date: dueDate,
    reference: (payload as any).reference,
    notes: (payload as any).notes,
    created_at: now,
    updated_at: now,
  };
  mockPurchases.push(pur);
  applyStockForPurchase(pur);
  // If linked PO is sent, mark it received (GRN) — stock now via purchase
  if (po && po.status !== "received") {
    const idx = mockPurchaseOrders.findIndex((p) => p.id === po.id);
    if (idx !== -1) {
      mockPurchaseOrders[idx] = { ...po, status: "received", received_at: now, updated_at: now };
    }
  }
  return { ...pur };
}
export async function updatePurchase(
  id: string,
  payload: Partial<PurchasePayload> & {
    paid_amount?: number;
    payment_mode?: string;
    due_date?: string;
    reference?: string;
    notes?: string;
  },
): Promise<Purchase> {
  await delay(600);
  const idx = mockPurchases.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase not found");
  const current = mockPurchases[idx];
  if (current.payment_status === "paid")
    throw new Error("Cannot edit paid purchase — create credit note");
  const materials = materialMap();
  let items = current.items;
  if (payload.items) {
    items = payload.items.map((it) => ({
      material_id: it.material_id,
      material_name: materials[it.material_id]?.name ?? it.material_id,
      qty: it.qty,
      unit_cost: it.unit_cost,
      tax_percent: (it as any).tax_percent ?? materials[it.material_id]?.tax_percent ?? 5,
      line_total: Math.round(it.qty * it.unit_cost * 100) / 100,
    })) as any;
  }
  const { subtotal, tax_amount, total_amount } = payload.items
    ? computePurchaseTotals(items as any)
    : {
        subtotal: current.subtotal,
        tax_amount: current.tax_amount,
        total_amount: current.total_amount,
      };
  const paid = payload.paid_amount ?? current.paid_amount;
  if (paid < 0 || paid > total_amount) throw new Error("Paid amount must be 0..total");
  const updated: Purchase = {
    ...current,
    supplier_id: payload.supplier_id ?? current.supplier_id,
    supplier_name: payload.supplier_id
      ? (supplierNameMap()[payload.supplier_id] ?? current.supplier_name)
      : current.supplier_name,
    items: items as any,
    subtotal,
    tax_amount,
    total_amount,
    paid_amount: Math.round(paid * 100) / 100,
    payment_status: derivePaymentStatus(total_amount, paid),
    payment_mode: (payload as any).payment_mode ?? current.payment_mode,
    bill_date: payload.bill_date ?? current.bill_date,
    due_date: (payload as any).due_date ?? current.due_date,
    reference: (payload as any).reference ?? (current as any).reference,
    notes: (payload as any).notes ?? current.notes,
    updated_at: new Date().toISOString(),
  };
  // Stock delta: for MVP, do not reverse old stock on update (audit requires credit note). Keep simple.
  mockPurchases[idx] = updated;
  return { ...updated };
}
export async function deletePurchase(id: string): Promise<void> {
  await delay(500);
  const idx = mockPurchases.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase not found");
  if (mockPurchases[idx].payment_status !== "unpaid")
    throw new Error(
      "Only unpaid purchases can be deleted — void partial/paid via credit (Odoo: Cancel/Credit, Zoho: Void)",
    );
  mockPurchases.splice(idx, 1);
}
export async function recordPurchasePayment(
  id: string,
  amount: number,
  mode?: string,
): Promise<Purchase> {
  await delay(400);
  const idx = mockPurchases.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Purchase not found");
  const pur = mockPurchases[idx];
  const newPaid = Math.round((pur.paid_amount + amount) * 100) / 100;
  if (newPaid > pur.total_amount) throw new Error("Paid exceeds total");
  const updated = {
    ...pur,
    paid_amount: newPaid,
    payment_status: derivePaymentStatus(pur.total_amount, newPaid),
    payment_mode: (mode as any) ?? pur.payment_mode,
    updated_at: new Date().toISOString(),
  };
  mockPurchases[idx] = updated;
  return { ...updated };
}

// Waste
export async function getWasteLogs(filters?: WasteFilters): Promise<WasteLog[]> {
  await delay(400);
  let result = [...mockWaste].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (w) => (w.material_name ?? "").toLowerCase().includes(q) || w.reason.includes(q),
    );
  }
  if (filters?.reason) result = result.filter((w) => w.reason === filters.reason);
  return result;
}

export async function createWasteLog(payload: WastePayload): Promise<WasteLog> {
  await delay(600);
  const materials = materialMap();
  const mat = payload.material_id ? materials[payload.material_id] : undefined;
  const costLoss = (mat?.avg_cost ?? 0) * payload.qty;
  const prev = mat?.stock_qty ?? 0;
  if (mat) {
    const newQty = Math.max(0, prev - payload.qty);
    const idx = mockRawMaterials.findIndex((m) => m.id === payload.material_id);
    if (idx !== -1) {
      mockRawMaterials[idx].stock_qty = newQty;
      mockRawMaterials[idx].updated_at = new Date().toISOString();
      mockStockLedger.push({
        id: `stk_${Date.now().toString(36)}_waste`,
        material_id: payload.material_id!,
        material_name: mat.name,
        type: "waste",
        qty_delta: -payload.qty,
        reason: payload.reason,
        reference_id: "",
        previous_qty: prev,
        new_qty: newQty,
        unit_cost: mat.avg_cost,
        total_cost: Math.round(costLoss * 100) / 100,
        avg_cost_before: mat.avg_cost,
        avg_cost_after: mat.avg_cost,
        created_at: new Date().toISOString(),
      });
    }
  }
  const log: WasteLog = {
    id: `wst_${Date.now().toString(36)}`,
    material_id: payload.material_id,
    material_name: mat?.name,
    recipe_id: payload.recipe_id,
    qty: payload.qty,
    unit: payload.unit ?? mat?.unit ?? "pcs",
    reason: payload.reason,
    notes: payload.notes,
    cost_loss: Math.round(costLoss * 100) / 100,
    created_at: new Date().toISOString(),
  };
  mockWaste.push(log);
  return { ...log };
}

// Stock Ledger
export async function getStockLedger(): Promise<StockLedgerEntry[]> {
  await delay(400);
  return [...mockStockLedger].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPriceHistory(materialId?: string): Promise<MaterialPriceHistory[]> {
  await delay(300);
  let result = [...mockPriceHistory].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (materialId) result = result.filter((h) => h.material_id === materialId);
  return result;
}

export async function getSupplierPriceComparison(materialId: string) {
  await delay(300);
  const history = mockPriceHistory.filter(
    (h) => h.material_id === materialId && (h.source === "po_receive" || h.source === "purchase"),
  );
  const grouped: Record<
    string,
    { supplier_id: string; last_cost: number; last_date: string; avg_cost: number; count: number }
  > = {};
  // Derive supplier from PO reference if possible via stock ledger? Simplified: use last PO supplier
  for (const h of history) {
    const po = mockPurchaseOrders.find((p) => p.id === h.reference_id);
    const supId = po?.supplier_id ?? "unknown";
    if (!grouped[supId])
      grouped[supId] = {
        supplier_id: supId,
        last_cost: h.unit_cost,
        last_date: h.created_at,
        avg_cost: h.unit_cost,
        count: 1,
      };
    else {
      grouped[supId].avg_cost =
        (grouped[supId].avg_cost * grouped[supId].count + h.unit_cost) / (grouped[supId].count + 1);
      grouped[supId].count += 1;
      if (new Date(h.created_at) > new Date(grouped[supId].last_date)) {
        grouped[supId].last_cost = h.unit_cost;
        grouped[supId].last_date = h.created_at;
      }
    }
  }
  return Object.values(grouped).map((g) => ({
    ...g,
    supplier_name: mockSuppliers.find((s) => s.id === g.supplier_id)?.name ?? g.supplier_id,
    avg_cost: Math.round(g.avg_cost * 100) / 100,
  }));
}

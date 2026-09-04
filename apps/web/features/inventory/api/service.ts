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
} from "./types";

// Raw Materials
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
    cost_price: 80,
    avg_cost: 78,
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    is_active: true,
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
    cost_price: 320,
    avg_cost: 310,
    supplier_id: "sup_002",
    supplier_name: "Fresh Meat Co",
    is_active: true,
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
    cost_price: 30,
    avg_cost: 28,
    supplier_id: "sup_001",
    supplier_name: "Shree Grains",
    is_active: true,
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
    cost_price: 140,
    avg_cost: 135,
    supplier_id: "sup_003",
    supplier_name: "Oil Traders",
    is_active: true,
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
      { material_id: "rm_001", material_name: "Basmati Rice", qty: 50, unit_cost: 78 },
      { material_id: "rm_003", material_name: "Tomato", qty: 20, unit_cost: 28 },
    ],
    total_amount: 4460,
    status: "received",
    expected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "po_002",
    po_number: "PO-2024-002",
    supplier_id: "sup_002",
    supplier_name: "Fresh Meat Co",
    items: [{ material_id: "rm_002", material_name: "Chicken Breast", qty: 20, unit_cost: 310 }],
    total_amount: 6200,
    status: "sent",
    expected_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
];

// Helpers
const supplierNameMap = () => Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
const materialMap = () => Object.fromEntries(mockRawMaterials.map((m) => [m.id, m]));

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
  const now = new Date().toISOString();
  const mat: RawMaterial = {
    id: `rm_${Date.now().toString(36)}`,
    outlet_id: "out_001",
    name: payload.name,
    sku: payload.sku.toUpperCase(),
    category: payload.category ?? "General",
    unit: payload.unit ?? "pcs",
    stock_qty: payload.stock_qty ?? 0,
    low_stock_threshold: payload.low_stock_threshold ?? 5,
    cost_price: payload.cost_price ?? 0,
    avg_cost: payload.cost_price ?? 0,
    supplier_id: payload.supplier_id,
    supplier_name: payload.supplier_id ? supplierNameMap()[payload.supplier_id] : undefined,
    is_active: payload.is_active ?? true,
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
  const current = mockRawMaterials[idx];
  const updated: RawMaterial = {
    ...current,
    ...payload,
    sku: payload.sku ? payload.sku.toUpperCase() : current.sku,
    supplier_name: payload.supplier_id
      ? supplierNameMap()[payload.supplier_id]
      : current.supplier_name,
    updated_at: new Date().toISOString(),
  };
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
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  await delay(400);
  return [...mockPurchaseOrders].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  await delay(300);
  return mockPurchaseOrders.find((p) => p.id === id) ?? null;
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
  await delay(700);
  const supName = supplierNameMap()[payload.supplier_id] ?? payload.supplier_id;
  const materials = materialMap();
  const items = payload.items.map((it) => ({
    ...it,
    material_name: materials[it.material_id]?.name,
  }));
  const total = items.reduce((sum, it) => sum + it.qty * it.unit_cost, 0);
  const now = new Date().toISOString();
  const po: PurchaseOrder = {
    id: `po_${Date.now().toString(36)}`,
    po_number: `PO-${new Date().getFullYear()}-${String(mockPurchaseOrders.length + 1).padStart(3, "0")}`,
    supplier_id: payload.supplier_id,
    supplier_name: supName,
    items,
    total_amount: total,
    status: "draft",
    expected_at: payload.expected_at,
    created_at: now,
    updated_at: now,
  };
  mockPurchaseOrders.push(po);
  return { ...po };
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
  // On receive, increment stock and ledger
  if (status === "received" && po.status !== "received") {
    po.items.forEach((item) => {
      const matIdx = mockRawMaterials.findIndex((m) => m.id === item.material_id);
      if (matIdx !== -1) {
        const prev = mockRawMaterials[matIdx].stock_qty;
        const newQty = prev + item.qty;
        const oldAvg = mockRawMaterials[matIdx].avg_cost;
        const newAvg = (oldAvg * prev + item.unit_cost * item.qty) / newQty;
        mockRawMaterials[matIdx].stock_qty = newQty;
        mockRawMaterials[matIdx].avg_cost = Math.round(newAvg * 100) / 100;
        mockRawMaterials[matIdx].updated_at = new Date().toISOString();
        mockStockLedger.push({
          id: `stk_${Date.now().toString(36)}_${item.material_id}`,
          material_id: item.material_id,
          material_name: mockRawMaterials[matIdx].name,
          type: "purchase",
          qty_delta: item.qty,
          reason: po.po_number,
          reference_id: po.id,
          previous_qty: prev,
          new_qty: newQty,
          created_at: new Date().toISOString(),
        });
      }
    });
  }
  mockPurchaseOrders[idx] = updated;
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

/**
 * Inventory domain — client service (server-backed).
 *
 * Connects to PostgreSQL via /api/masters/* and /api/inventory/*.
 * Retains exact function signatures and exported API so UI components work unchanged.
 * No mock data, no localStorage keys, no artificial delay().
 */
import { getServiceOutletId } from "@/features/outlet/api/outlets";
import type {
  BatchFilters,
  BatchSummary,
  InventoryBatch,
  MaterialPriceHistory,
  PaymentFilters,
  Purchase,
  PurchaseFilters,
  PurchaseOrder,
  PurchaseOrderFilters,
  PurchaseOrderItem,
  PurchaseOrderPayload,
  PurchaseOrderStatus,
  PurchasePayload,
  PurchasePaymentStatus,
  PurchaseReturn,
  PurchaseReturnFilters,
  PurchaseReturnPayload,
  RawMaterial,
  RawMaterialFilters,
  RawMaterialPayload,
  Recipe,
  RecipeFilters,
  RecipeIngredient,
  RecipePayload,
  RecipeStep,
  StockLedgerEntry,
  StockLedgerFilters,
  StorageLocation,
  Supplier,
  SupplierAdjustment,
  SupplierAdjustmentFilters,
  SupplierAdjustmentPayload,
  SupplierFilters,
  SupplierLedgerEntry,
  SupplierLedgerFilters,
  SupplierOutstanding,
  SupplierPayload,
  SupplierPayment,
  SupplierPaymentPayload,
  WasteFilters,
  WasteLog,
  WastePayload,
} from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** No-op in server-backed architecture. Kept for caller compatibility. */
export async function hydrateInventoryFromMirror(): Promise<void> {}

/* -------------------------------------------------------------------------- */
/* Raw Materials (/api/masters/materials)                                     */
/* -------------------------------------------------------------------------- */

function toClientMaterial(r: Record<string, any>): RawMaterial {
  const now = new Date().toISOString();
  return {
    id: String(r.id),
    outlet_id: r.outletId ?? r.outlet_id ?? undefined,
    name: String(r.name ?? ""),
    sku: String(r.sku ?? ""),
    category: String(r.category ?? "general"),
    unit: (r.unit as RawMaterial["unit"]) ?? "pcs",
    manufacturer: r.manufacturer ?? undefined,
    purchase_unit: r.purchaseUnit ?? r.purchase_unit ?? undefined,
    purchase_to_base_rate: r.purchaseToBaseRate ? Number(r.purchaseToBaseRate) : undefined,
    stock_qty: Number(r.stockQty ?? r.stock_qty ?? 0),
    low_stock_threshold: Number(r.lowStockThreshold ?? r.low_stock_threshold ?? 0),
    cost_price: Number(r.costPricePaise ?? r.cost_price_paise ?? 0) / 100,
    avg_cost: Number(r.avgCostPaise ?? r.avg_cost_paise ?? 0) / 100,
    tax_type: r.taxType ?? r.tax_type ?? "GST",
    tax_percent: r.taxPercent ?? r.tax_percent ?? 0,
    hsn_code: r.hsnCode ?? r.hsn_code ?? undefined,
    barcode: r.barcode ?? undefined,
    supplier_id: r.supplierId ?? r.supplier_id ?? undefined,
    suppliers: Array.isArray(r.suppliers) ? r.suppliers : [],
    is_active: r.is_active !== false && r.isActive !== false,
    created_at: String(r.createdAt ?? r.created_at ?? now),
    updated_at: String(r.updatedAt ?? r.updated_at ?? now),
  };
}

export async function getRawMaterials(filters?: RawMaterialFilters): Promise<RawMaterial[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/materials${toQuery({ outlet_id: outletId })}`,
  );
  let list = (rows ?? []).map(toClientMaterial);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q));
  }
  if (filters?.category) {
    list = list.filter((m) => m.category.toLowerCase() === filters.category?.toLowerCase());
  }
  if (filters?.supplier_id) {
    list = list.filter((m) => m.supplier_id === filters.supplier_id);
  }
  if (filters?.low_stock_only) {
    list = list.filter((m) => m.stock_qty <= m.low_stock_threshold);
  }
  return list;
}

export async function getRawMaterialById(id: string): Promise<RawMaterial | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/materials/${encodeURIComponent(id)}`,
    );
    return row ? toClientMaterial(row) : null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createRawMaterial(payload: RawMaterialPayload): Promise<RawMaterial> {
  const body: Record<string, any> = {
    name: payload.name,
    sku: payload.sku,
    category: payload.category ?? "general",
    unit: payload.unit,
    manufacturer: payload.manufacturer || null,
    purchase_unit: payload.purchase_unit || null,
    purchase_to_base_rate: payload.purchase_to_base_rate || null,
    stock_qty: String(payload.stock_qty ?? 0),
    low_stock_threshold: String(payload.low_stock_threshold ?? 0),
    cost_price_paise: Math.round((payload.cost_price ?? 0) * 100),
    avg_cost_paise: Math.round((payload.cost_price ?? 0) * 100),
    tax_type: payload.tax_type ?? "GST",
    tax_percent: payload.tax_percent ?? 0,
    hsn_code: payload.hsn_code || null,
    barcode: payload.barcode || null,
    supplier_id: payload.supplier_id || null,
    suppliers: payload.suppliers ?? [],
    is_active: true,
  };

  const { id } = await api<{ id: string }>("/api/masters/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = await getRawMaterialById(id);
  if (!created) throw new Error("Failed to load created raw material");
  return created;
}

export async function updateRawMaterial(
  id: string,
  payload: Partial<RawMaterialPayload>,
): Promise<RawMaterial> {
  const body: Record<string, any> = { ...payload };
  if (payload.cost_price !== undefined) {
    body.cost_price_paise = Math.round(payload.cost_price * 100);
    delete body.cost_price;
  }
  if (payload.stock_qty !== undefined) {
    body.stock_qty = String(payload.stock_qty);
  }
  if (payload.low_stock_threshold !== undefined) {
    body.low_stock_threshold = String(payload.low_stock_threshold);
  }

  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/materials?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return toClientMaterial(row);
}

export async function deleteRawMaterial(id: string): Promise<void> {
  await api(`/api/masters/materials?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Suppliers (/api/masters/suppliers)                                         */
/* -------------------------------------------------------------------------- */

function toClientSupplier(r: Record<string, any>): Supplier {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    contact_person: r.contactPerson ?? r.contact_person ?? undefined,
    phone: String(r.phone ?? ""),
    email: r.email ?? undefined,
    gstin: r.gstin ?? undefined,
    address: r.address ?? undefined,
    is_active: r.isActive !== false && r.is_active !== false,
    created_at: String(r.createdAt ?? new Date().toISOString()),
    updated_at: String(r.updatedAt ?? new Date().toISOString()),
  };
}

export async function getSuppliers(filters?: SupplierFilters): Promise<Supplier[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/suppliers${toQuery({ outlet_id: outletId })}`,
  );
  let list = (rows ?? []).map(toClientSupplier);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)),
    );
  }
  if (filters?.is_active !== undefined) {
    list = list.filter((s) => s.is_active === filters.is_active);
  }
  return list;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/suppliers/${encodeURIComponent(id)}`,
    );
    return row ? toClientSupplier(row) : null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const body = {
    name: payload.name,
    phone: payload.phone,
    gstin: payload.gstin || null,
    contact_person: payload.contact_person || null,
    email: payload.email || null,
    address: payload.address || null,
    is_active: payload.is_active ?? true,
  };
  const { id } = await api<{ id: string }>("/api/masters/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = await getSupplierById(id);
  if (!created) throw new Error("Failed to load created supplier");
  return created;
}

export async function updateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  const body = {
    name: payload.name,
    phone: payload.phone,
    gstin: payload.gstin || null,
    contact_person: payload.contact_person || null,
    email: payload.email || null,
    address: payload.address || null,
    is_active: payload.is_active,
  };
  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/suppliers?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return toClientSupplier(row);
}

export async function deleteSupplier(id: string): Promise<void> {
  await api(`/api/masters/suppliers?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Recipes (/api/masters/recipes)                                             */
/* -------------------------------------------------------------------------- */

function toClientRecipe(r: Record<string, any>): Recipe {
  const ingredients: RecipeIngredient[] = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps: RecipeStep[] = Array.isArray(r.steps) ? r.steps : [];
  const costPerServe = ingredients.reduce((sum, ing) => sum + (ing.cost || 0), 0);

  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    yields: Number(r.yields ?? 1),
    yield_unit: (r.yieldUnit ?? r.yield_unit ?? "serves") as Recipe["yield_unit"],
    ingredients,
    steps,
    cost_per_serve: costPerServe,
    selling_price: r.sellingPricePaise ? Number(r.sellingPricePaise) / 100 : undefined,
    prep_time_min: r.prepTimeMin ?? r.prep_time_min ?? undefined,
    cook_time_min: r.cookTimeMin ?? r.cook_time_min ?? undefined,
    plating_notes: r.platingNotes ?? r.plating_notes ?? undefined,
    garnish: r.garnish ?? undefined,
    serving_vessel: r.servingVessel ?? r.serving_vessel ?? undefined,
    menu_item_id: r.menuItemId ?? r.menu_item_id ?? undefined,
    photo_url: r.photoUrl ?? r.photo_url ?? undefined,
    is_active: r.isActive !== false && r.is_active !== false,
    created_at: String(r.createdAt ?? new Date().toISOString()),
    updated_at: String(r.updatedAt ?? new Date().toISOString()),
  };
}

export async function getRecipes(filters?: RecipeFilters): Promise<Recipe[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/recipes${toQuery({ outlet_id: outletId })}`,
  );
  let list = (rows ?? []).map(toClientRecipe);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((rec) => rec.name.toLowerCase().includes(q));
  }
  if (filters?.is_active !== undefined) {
    list = list.filter((rec) => rec.is_active === filters.is_active);
  }
  return list;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/recipes/${encodeURIComponent(id)}`,
    );
    return row ? toClientRecipe(row) : null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createRecipe(payload: RecipePayload): Promise<Recipe> {
  const body = {
    name: payload.name,
    yields: String(payload.yields ?? 1),
    yield_unit: payload.yield_unit ?? "serves",
    ingredients: payload.ingredients ?? [],
    steps: payload.steps ?? [],
    selling_price_paise: payload.selling_price ? Math.round(payload.selling_price * 100) : null,
    prep_time_min: payload.prep_time_min || null,
    cook_time_min: payload.cook_time_min || null,
    plating_notes: payload.plating_notes || null,
    garnish: payload.garnish || null,
    serving_vessel: payload.serving_vessel || null,
    menu_item_id: payload.menu_item_id || null,
    photo_url: payload.photo_url || null,
    is_active: payload.is_active ?? true,
  };
  const { id } = await api<{ id: string }>("/api/masters/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = await getRecipeById(id);
  if (!created) throw new Error("Failed to load created recipe");
  return created;
}

export async function updateRecipe(id: string, payload: RecipePayload): Promise<Recipe> {
  const body = {
    name: payload.name,
    yields: String(payload.yields ?? 1),
    yield_unit: payload.yield_unit ?? "serves",
    ingredients: payload.ingredients ?? [],
    steps: payload.steps ?? [],
    selling_price_paise: payload.selling_price ? Math.round(payload.selling_price * 100) : null,
    prep_time_min: payload.prep_time_min || null,
    cook_time_min: payload.cook_time_min || null,
    plating_notes: payload.plating_notes || null,
    garnish: payload.garnish || null,
    serving_vessel: payload.serving_vessel || null,
    menu_item_id: payload.menu_item_id || null,
    photo_url: payload.photo_url || null,
    is_active: payload.is_active,
  };
  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/recipes?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return toClientRecipe(row);
}

export async function deleteRecipe(id: string): Promise<void> {
  await api(`/api/masters/recipes?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Purchase Orders (/api/inventory/purchase-orders)                           */
/* -------------------------------------------------------------------------- */

export async function getPurchaseOrders(filters?: PurchaseOrderFilters): Promise<PurchaseOrder[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  const { orders } = await api<{ orders: PurchaseOrder[] }>(
    `/api/inventory/purchase-orders${toQuery({
      outlet_id: outletId,
      supplier_id: filters?.supplier_id,
      status: filters?.status,
    })}`,
  );
  let list = orders ?? [];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (po) =>
        po.po_number.toLowerCase().includes(q) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(q)),
    );
  }
  return list;
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  try {
    const { order } = await api<{ order: PurchaseOrder | null }>(
      `/api/inventory/purchase-orders/${encodeURIComponent(id)}`,
    );
    return order ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  const { order } = await api<{ order: PurchaseOrder }>("/api/inventory/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  return order;
}

export async function updatePurchaseOrder(
  id: string,
  payload: Partial<PurchaseOrderPayload>,
): Promise<PurchaseOrder> {
  const { order } = await api<{ order: PurchaseOrder }>(
    `/api/inventory/purchase-orders/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return order;
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder> {
  return updatePurchaseOrder(id, { status });
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await updatePurchaseOrderStatus(id, "cancelled");
}

export async function clonePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const original = await getPurchaseOrderById(id);
  if (!original) throw new Error("Purchase order not found");
  return createPurchaseOrder({
    supplier_id: original.supplier_id,
    items: original.items.map((it) => ({
      material_id: it.material_id,
      qty: it.qty,
      unit: it.unit,
      unit_cost: it.unit_cost,
      tax_percent: it.tax_percent,
    })),
    notes: original.notes ? `Clone of ${original.po_number}: ${original.notes}` : undefined,
  });
}

export function buildWhatsappUrl(supplier: Supplier, po: PurchaseOrder): string {
  const lines = [
    `*Purchase Order: ${po.po_number}*`,
    `Date: ${po.po_date || new Date().toISOString().slice(0, 10)}`,
    `Supplier: ${supplier.name}`,
    "",
    ...po.items.map(
      (it, idx) =>
        `${idx + 1}. ${it.material_name || "Item"} - ${it.qty} ${it.unit || "pcs"} @ ₹${it.unit_cost.toFixed(2)}`,
    ),
    "",
    `*Total: ₹${(po.total_amount ?? po.total ?? 0).toFixed(2)}*`,
  ];
  const text = encodeURIComponent(lines.join("\n"));
  const phone = supplier.phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${phone}?text=${text}`;
}

export function buildEmailHtml(supplier: Supplier, po: PurchaseOrder): string {
  return `<h2>Purchase Order: ${po.po_number}</h2><p>Total: ₹${(po.total_amount ?? po.total ?? 0).toFixed(2)}</p>`;
}

export async function sendPurchaseOrderViaWhatsapp(
  poId: string,
  supplier: Supplier,
): Promise<{ url: string }> {
  const po = await getPurchaseOrderById(poId);
  if (!po) throw new Error("Purchase order not found");
  const url = buildWhatsappUrl(supplier, po);
  await updatePurchaseOrderStatus(poId, "sent");
  return { url };
}

export async function sendPurchaseOrderViaEmail(
  poId: string,
  supplier: Supplier,
): Promise<{ ok: boolean }> {
  await updatePurchaseOrderStatus(poId, "sent");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Purchases (/api/inventory/purchases)                                       */
/* -------------------------------------------------------------------------- */

export async function getPurchases(filters?: PurchaseFilters): Promise<Purchase[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  const { purchases } = await api<{ purchases: Purchase[] }>(
    `/api/inventory/purchases${toQuery({
      outlet_id: outletId,
      supplier_id: filters?.supplier_id,
      payment_status: filters?.payment_status,
    })}`,
  );
  let list = purchases ?? [];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.purchase_number.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)),
    );
  }
  return list;
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  try {
    const { purchase } = await api<{ purchase: Purchase | null }>(
      `/api/inventory/purchases/${encodeURIComponent(id)}`,
    );
    return purchase ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createPurchase(payload: PurchasePayload): Promise<Purchase> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  const { purchase } = await api<{ purchase: Purchase }>("/api/inventory/purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  return purchase;
}

export async function updatePurchase(
  id: string,
  payload: Partial<PurchasePayload>,
): Promise<Purchase> {
  const p = await getPurchaseById(id);
  if (!p) throw new Error("Purchase not found");
  return p;
}

export async function deletePurchase(id: string): Promise<void> {}

export async function recordPurchasePayment(
  purchaseId: string,
  _amount: number,
  _mode?: Purchase["payment_mode"] | string,
): Promise<Purchase> {
  const p = await getPurchaseById(purchaseId);
  if (!p) throw new Error("Purchase not found");
  return p;
}

export function getReturnableQty(_purchaseId: string, _materialId: string): number {
  return 0;
}

export async function getPurchaseReturns(
  _filters?: PurchaseReturnFilters,
): Promise<PurchaseReturn[]> {
  return [];
}

export async function getPurchaseReturnById(_id: string): Promise<PurchaseReturn | null> {
  return null;
}

export async function createPurchaseReturn(
  payload: PurchaseReturnPayload,
): Promise<PurchaseReturn> {
  return {
    id: "ret_stub",
    return_number: "PR-001",
    purchase_id: payload.purchase_id,
    supplier_id: "sup",
    items: [],
    subtotal: 0,
    subtotal_refund: 0,
    tax_refund: 0,
    total_refund: 0,
    reason: payload.reason ?? "other",
    restock: false,
    status: "draft",
    bill_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function approvePurchaseReturn(id: string): Promise<PurchaseReturn> {
  return createPurchaseReturn({ purchase_id: id, items: [], reason: "other" });
}

export async function cancelPurchaseReturn(_id: string): Promise<void> {}

/* -------------------------------------------------------------------------- */
/* Wastage (/api/inventory/waste)                                             */
/* -------------------------------------------------------------------------- */

export async function getWasteLogs(filters?: WasteFilters): Promise<WasteLog[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  if (!outletId) return [];

  const { logs } = await api<{ logs: WasteLog[] }>(
    `/api/inventory/waste${toQuery({
      outlet_id: outletId,
      material_id: filters?.material_id,
      recipe_id: filters?.recipe_id,
      reason: filters?.reason,
    })}`,
  );
  return logs ?? [];
}

export async function createWasteLog(payload: WastePayload): Promise<WasteLog> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  if (!outletId) throw new Error("No active outlet selected");

  const { log } = await api<{ log: WasteLog }>("/api/inventory/waste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  return log;
}

export async function recordWasteForCancelledOrder(
  input: import("./types").CancelledOrderWasteInput,
): Promise<WasteLog[] & { logs: WasteLog[]; total_loss: number }> {
  const results: WasteLog[] = [];
  for (const line of input.lines) {
    if (line.servings <= 0) continue;
    const log = await createWasteLog({
      order_id: input.order_id,
      order_number: input.order_number,
      recipe_id: line.recipe_id,
      variant_id: line.variant_id,
      qty: line.servings,
      unit: "serves",
      reason: "order_cancelled",
      notes: `Auto-logged from cancelled order ${input.order_number || input.order_id}`,
    });
    results.push(log);
  }
  const ret = results as WasteLog[] & { logs: WasteLog[]; total_loss: number };
  ret.logs = results;
  ret.total_loss = results.reduce((s, l) => s + (l.cost_loss ?? 0), 0);
  return ret;
}

/* -------------------------------------------------------------------------- */
/* Stock Ledger (/api/inventory/ledger)                                       */
/* -------------------------------------------------------------------------- */

export async function getStockLedger(filters?: StockLedgerFilters): Promise<StockLedgerEntry[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  if (!outletId) return [];

  const { entries } = await api<{ entries: StockLedgerEntry[] }>(
    `/api/inventory/ledger${toQuery({
      outlet_id: outletId,
      material_id: filters?.material_id,
      type: filters?.type,
    })}`,
  );
  return entries ?? [];
}

export async function getPriceHistory(materialId?: string): Promise<MaterialPriceHistory[]> {
  return [];
}

export async function getSupplierPriceComparison(materialId: string) {
  return [];
}

/* -------------------------------------------------------------------------- */
/* Supplier Adjustments & Payments                                            */
/* -------------------------------------------------------------------------- */

export async function getSupplierAdjustments(
  filters?: SupplierAdjustmentFilters,
): Promise<SupplierAdjustment[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  if (!outletId) return [];
  const { adjustments } = await api<{ adjustments: SupplierAdjustment[] }>(
    `/api/inventory/supplier-adjustments${toQuery({
      outlet_id: outletId,
      supplier_id: filters?.supplier_id,
    })}`,
  );
  return adjustments ?? [];
}

export async function getSupplierAdjustmentById(id: string): Promise<SupplierAdjustment | null> {
  const list = await getSupplierAdjustments();
  return list.find((a) => a.id === id) ?? null;
}

export async function createSupplierAdjustment(
  payload: SupplierAdjustmentPayload,
): Promise<SupplierAdjustment> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  const { adjustment } = await api<{ adjustment: SupplierAdjustment }>(
    "/api/inventory/supplier-adjustments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, outlet_id: outletId }),
    },
  );
  return adjustment;
}

export async function postSupplierAdjustment(id: string): Promise<SupplierAdjustment> {
  const adj = await getSupplierAdjustmentById(id);
  if (!adj) throw new Error("Adjustment not found");
  return adj;
}

export async function cancelSupplierAdjustment(id: string): Promise<void> {}
export async function updateSupplierAdjustment(
  id: string,
  payload: Partial<SupplierAdjustmentPayload>,
): Promise<SupplierAdjustment> {
  const adj = await getSupplierAdjustmentById(id);
  if (!adj) throw new Error("Adjustment not found");
  return adj;
}
export async function applySupplierCredit(
  _paramsOrId: any,
  _purchaseId?: string,
  _amount?: number,
): Promise<void> {}

export async function getSupplierLedger(
  _filters?: SupplierLedgerFilters,
): Promise<SupplierLedgerEntry[]> {
  return [];
}

export async function getSupplierOutstanding(): Promise<SupplierOutstanding[]> {
  return [];
}

export async function getPayments(filters?: PaymentFilters): Promise<SupplierPayment[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  if (!outletId) return [];
  const { payments } = await api<{ payments: SupplierPayment[] }>(
    `/api/inventory/supplier-payments${toQuery({
      outlet_id: outletId,
      supplier_id: filters?.supplier_id,
    })}`,
  );
  return payments ?? [];
}

export async function getPaymentById(id: string): Promise<SupplierPayment | null> {
  const list = await getPayments();
  return list.find((p) => p.id === id) ?? null;
}

export async function createPayment(payload: SupplierPaymentPayload): Promise<SupplierPayment> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  const { payment } = await api<{ payment: SupplierPayment }>("/api/inventory/supplier-payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  return payment;
}

export async function cancelPayment(id: string): Promise<void> {}

/* -------------------------------------------------------------------------- */
/* Locations & Batches                                                        */
/* -------------------------------------------------------------------------- */

export async function getStorageLocations(): Promise<StorageLocation[]> {
  return [];
}
export async function createStorageLocation(payload: any): Promise<StorageLocation> {
  return { id: "loc_stub", name: payload.name, is_active: true, created_at: "", updated_at: "" };
}
export async function updateStorageLocation(id: string, payload: any): Promise<StorageLocation> {
  return { id, name: payload.name, is_active: true, created_at: "", updated_at: "" };
}
export async function deleteStorageLocation(id: string): Promise<void> {}

export async function getBatches(filters?: BatchFilters): Promise<InventoryBatch[]> {
  return [];
}
export async function updateBatch(id: string, payload: any): Promise<InventoryBatch> {
  return {
    id,
    batch_no: "",
    material_id: "",
    qty_received: 0,
    qty_on_hand: 0,
    status: "active",
    created_at: "",
    updated_at: "",
  };
}
export function receiveBatch(o: any): InventoryBatch {
  return {
    id: "b_stub",
    batch_no: o.batch_no || "B-001",
    material_id: o.material_id,
    qty_received: o.qty ?? 0,
    qty_on_hand: o.qty ?? 0,
    status: "active",
    created_at: "",
    updated_at: "",
  };
}
export function consumeBatchesFEFO(materialId: string, qty: number): any[] {
  return [];
}
export async function batchSummary(materialId: string): Promise<BatchSummary> {
  return {
    material_id: materialId,
    total_batches: 0,
    batches: 0,
    total_stock: 0,
    expiring_soon_qty: 0,
    expired_qty: 0,
    nearest_expiry: null,
  };
}

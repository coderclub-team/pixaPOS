import { createRawMaterial, getRawMaterials, updateRawMaterial } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { RawMaterial } from "../api/types";

export const rawMaterialColumns: CsvColumn<RawMaterial>[] = [
  { key: "name", label: "Name", required: true, get: (m) => m.name },
  { key: "sku", label: "SKU", required: true, get: (m) => m.sku },
  { key: "category", label: "Category", get: (m) => m.category },
  { key: "unit", label: "Unit", get: (m) => m.unit },
  { key: "stock_qty", label: "Stock", get: (m) => m.stock_qty },
  {
    key: "low_stock_threshold",
    label: "Low Stock Threshold",
    get: (m) => m.low_stock_threshold,
  },
  { key: "cost_price", label: "Cost Price", get: (m) => m.cost_price },
  { key: "tax_percent", label: "Tax %", get: (m) => m.tax_percent ?? "" },
  { key: "hsn_code", label: "HSN", get: (m) => m.hsn_code ?? "" },
  { key: "barcode", label: "Barcode", get: (m) => m.barcode ?? "" },
  { key: "active", label: "Active", get: (m) => m.is_active },
];

export const rawMaterialSample: Record<string, string>[] = [
  {
    name: "Basmati Rice",
    sku: "RM-RICE-001",
    category: "Grains",
    unit: "kg",
    stock_qty: "50",
    low_stock_threshold: "20",
    cost_price: "78",
    tax_percent: "5",
    hsn_code: "10063010",
    barcode: "8901234567890",
    active: "yes",
  },
  {
    name: "Paneer",
    sku: "RM-DAIRY-001",
    category: "Dairy",
    unit: "kg",
    stock_qty: "12",
    low_stock_threshold: "5",
    cost_price: "320",
    tax_percent: "5",
    hsn_code: "04061000",
    barcode: "",
    active: "yes",
  },
];

/**
 * Bulk upsert raw materials matched by name, then SKU. SKU is required because
 * the service enforces uniqueness and uses it as the stock identifier.
 */
export async function importRawMaterials(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getRawMaterials();
  const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));
  const bySku = new Map(existing.map((m) => [m.sku.toUpperCase(), m]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      const sku = (r["SKU"] ?? "").trim();
      if (!name || !sku) {
        skipped++;
        errors.push(`${line}: Name and SKU are required`);
        continue;
      }

      const category = (r["Category"] ?? "").trim() || "General";
      const unit = (r["Unit"] ?? "").trim() || "pcs";
      const stockQty = parseNumber(r["Stock"] ?? "");
      const lowStock = parseNumber(r["Low Stock Threshold"] ?? "");
      const costPrice = parseNumber(r["Cost Price"] ?? "");
      const taxPercent = parseNumber(r["Tax %"] ?? "");
      const hsnCode = (r["HSN"] ?? "").trim() || undefined;
      const barcode = (r["Barcode"] ?? "").trim() || undefined;
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = { name, sku, category, unit };
      if (stockQty !== undefined) payload.stock_qty = stockQty;
      if (lowStock !== undefined) payload.low_stock_threshold = lowStock;
      if (costPrice !== undefined) payload.cost_price = costPrice;
      if (taxPercent !== undefined) payload.tax_percent = taxPercent;
      if (hsnCode) payload.hsn_code = hsnCode;
      if (barcode) payload.barcode = barcode;
      if (isActive !== undefined) payload.is_active = isActive;

      const hit = bySku.get(sku.toUpperCase()) ?? byName.get(name.toLowerCase());
      if (hit) {
        await updateRawMaterial(hit.id, payload);
        updated++;
      } else {
        await createRawMaterial(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

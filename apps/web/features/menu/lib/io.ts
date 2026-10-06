import { createMenuItem, getMenuCategories, getMenuItems, updateMenuItem } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { MenuItem } from "../api/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const menuItemColumns: CsvColumn<MenuItem>[] = [
  { key: "name", label: "Name", required: true, get: (m) => m.name },
  { key: "category", label: "Category", required: true, get: (m) => m.category_name ?? "" },
  { key: "veg", label: "Veg Type", get: (m) => m.veg_type },
  { key: "item_type", label: "Item Type", get: (m) => (m as any).item_type ?? "service" },
  {
    key: "price",
    label: "Price",
    get: (m) => Math.min(...m.variants.map((v) => v.selling_price)),
  },
  { key: "barcode", label: "Barcode", get: (m) => (m as any).barcode ?? "" },
  { key: "hsn", label: "HSN/SAC", get: (m) => (m as any).hsn_code ?? "" },
  { key: "channels", label: "Channels", get: (m) => m.available_channels.join(";") },
  { key: "active", label: "Active", get: (m) => m.is_active },
];

export const menuItemSample: Record<string, string>[] = [
  {
    name: "Masala Dosa",
    category: "South Indian",
    veg: "veg",
    item_type: "service",
    price: "120",
    barcode: "",
    hsn: "996331",
    channels: "dine_in;pickup;delivery",
    active: "yes",
  },
  {
    name: "Choco Cookies 300g",
    category: "Packaged",
    veg: "veg",
    item_type: "goods",
    price: "85",
    barcode: "8901234567890",
    hsn: "1905",
    channels: "pickup;delivery",
    active: "yes",
  },
];

/**
 * Bulk upsert matched by slug. Unknown categories fail the row (import
 * categories first). Price sets the single Regular variant; multi-variant
 * products stay a dashboard edit.
 */
export async function importMenuItems(rows: Record<string, string>[]): Promise<ImportResult> {
  const [cats, existing] = await Promise.all([getMenuCategories(), getMenuItems()]);
  const bySlug = new Map(existing.map((m) => [m.slug, m]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      const category = (r["Category"] ?? "").trim();
      if (!name || !category) {
        skipped++;
        errors.push(`${line}: Name and Category are required`);
        continue;
      }
      const cat = cats.find((c) => c.name.toLowerCase() === category.toLowerCase());
      if (!cat) {
        skipped++;
        errors.push(`${line}: unknown category "${category}" — import categories first`);
        continue;
      }
      const veg = (r["Veg Type"] ?? "veg").trim().toLowerCase();
      const itemType =
        (r["Item Type"] ?? "service").trim().toLowerCase() === "goods" ? "goods" : "service";
      const price = parseNumber(r["Price"] ?? "") ?? 0;
      const channels = (r["Channels"] ?? "dine_in;pickup;delivery")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean) as any;
      const payload: any = {
        name,
        category_id: cat.id,
        veg_type: ["veg", "nonveg", "egg"].includes(veg) ? veg : "veg",
        item_type: itemType,
        barcode: itemType === "goods" ? (r["Barcode"] ?? "").trim() || undefined : undefined,
        hsn_code: (r["HSN/SAC"] ?? "").trim() || undefined,
        available_channels: channels.length > 0 ? channels : undefined,
        is_active: r["Active"] === "" ? undefined : parseYesNo(r["Active"]),
        basePrice: price,
      };
      const hit = bySlug.get(slugify(name));
      if (hit) {
        // Single-variant products get their price refreshed; multi-variant
        // pricing stays a dashboard edit.
        if ((hit.variants ?? []).length <= 1) {
          const v = hit.variants[0];
          payload.variants = [
            v
              ? { ...v, selling_price: price }
              : { name: "Regular", sku: "", selling_price: price, is_active: true },
          ];
        }
        await updateMenuItem(hit.id, payload);
        updated++;
      } else {
        await createMenuItem(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return { created, updated, skipped, errors };
}

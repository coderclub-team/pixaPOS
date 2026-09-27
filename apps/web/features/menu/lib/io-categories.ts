import { createMenuCategory, getMenuCategories, updateMenuCategory } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { MenuCategory } from "../api/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const menuCategoryColumns: CsvColumn<MenuCategory>[] = [
  { key: "name", label: "Name", required: true, get: (c) => c.name },
  { key: "slug", label: "Slug", get: (c) => c.slug },
  { key: "sort_order", label: "Sort Order", get: (c) => c.sort_order ?? 0 },
  { key: "active", label: "Active", get: (c) => c.is_active },
];

export const menuCategorySample: Record<string, string>[] = [
  {
    name: "South Indian",
    slug: "south-indian",
    sort_order: "1",
    active: "yes",
  },
  {
    name: "Biryani & Rice",
    slug: "biryani-rice",
    sort_order: "2",
    active: "yes",
  },
];

/**
 * Bulk upsert menu categories matched by slug (auto-derived from name when blank).
 */
export async function importMenuCategories(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getMenuCategories();
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      if (!name) {
        skipped++;
        errors.push(`${line}: Name is required`);
        continue;
      }
      const slug = (r["Slug"] ?? "").trim() || slugify(name);
      const sortOrder = parseNumber(r["Sort Order"] ?? "");
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = { name, slug };
      if (sortOrder !== undefined) payload.sort_order = sortOrder;
      if (isActive !== undefined) payload.is_active = isActive;

      const hit = bySlug.get(slug);
      if (hit) {
        await updateMenuCategory(hit.id, payload);
        updated++;
      } else {
        await createMenuCategory(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

import { createFloor, getFloors, updateFloor } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { Floor } from "../api/types";

export const floorColumns: CsvColumn<Floor>[] = [
  { key: "name", label: "Name", required: true, get: (f) => f.name },
  { key: "code", label: "Code", required: true, get: (f) => f.code },
  { key: "level", label: "Level", get: (f) => f.level },
  { key: "capacity", label: "Capacity", get: (f) => f.capacity },
  { key: "sort_order", label: "Sort Order", get: (f) => f.sort_order },
  { key: "active", label: "Active", get: (f) => f.is_active },
  { key: "outdoor", label: "Outdoor", get: (f) => f.is_outdoor ?? false },
];

export const floorSample: Record<string, string>[] = [
  {
    name: "Ground Floor",
    code: "GF",
    level: "0",
    capacity: "50",
    sort_order: "1",
    active: "yes",
    outdoor: "no",
  },
  {
    name: "Rooftop",
    code: "RF",
    level: "1",
    capacity: "30",
    sort_order: "2",
    active: "yes",
    outdoor: "yes",
  },
];

/**
 * Bulk upsert floors matched by code.
 */
export async function importFloors(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getFloors();
  const byCode = new Map(existing.map((f) => [f.code.toUpperCase(), f]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      const code = (r["Code"] ?? "").trim();
      if (!name || !code) {
        skipped++;
        errors.push(`${line}: Name and Code are required`);
        continue;
      }

      const level = parseNumber(r["Level"] ?? "");
      const capacity = parseNumber(r["Capacity"] ?? "");
      const sortOrder = parseNumber(r["Sort Order"] ?? "");
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);
      const isOutdoor = r["Outdoor"] === "" ? undefined : parseYesNo(r["Outdoor"]);

      const payload: any = { name, code };
      if (level !== undefined) payload.level = level;
      if (capacity !== undefined) payload.capacity = capacity;
      if (sortOrder !== undefined) payload.sort_order = sortOrder;
      if (isActive !== undefined) payload.is_active = isActive;
      if (isOutdoor !== undefined) payload.is_outdoor = isOutdoor;

      const hit = byCode.get(code.toUpperCase());
      if (hit) {
        await updateFloor(hit.id, payload);
        updated++;
      } else {
        await createFloor(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

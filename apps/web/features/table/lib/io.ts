import { createTable, getTables, updateTable } from "../api/service";
import { getFloors } from "@/features/floor/api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { RestaurantTable } from "../api/types";

export const tableColumns = (floorNameById: Map<string, string>): CsvColumn<RestaurantTable>[] => [
  {
    key: "floor",
    label: "Floor",
    required: true,
    get: (t) => floorNameById.get(t.floor_id) ?? t.floor_id,
  },
  { key: "number", label: "Number", required: true, get: (t) => t.number },
  { key: "code", label: "Code", get: (t) => t.code },
  { key: "capacity", label: "Capacity", required: true, get: (t) => t.capacity },
  { key: "shape", label: "Shape", get: (t) => t.shape },
  { key: "sharing", label: "Sharing", get: (t) => t.allows_sharing },
  { key: "active", label: "Active", get: (t) => t.is_active },
];

export const tableSample: Record<string, string>[] = [
  {
    floor: "Ground Floor",
    number: "T1",
    code: "T001",
    capacity: "4",
    shape: "square",
    sharing: "no",
    active: "yes",
  },
  {
    floor: "Rooftop",
    number: "T2",
    code: "T002",
    capacity: "6",
    shape: "round",
    sharing: "yes",
    active: "yes",
  },
];

/**
 * Bulk upsert tables matched by code. Floors are resolved by name; the first
 * matching floor is used.
 */
export async function importTables(rows: Record<string, string>[]): Promise<ImportResult> {
  const [floors, existing] = await Promise.all([getFloors(), getTables()]);
  const floorByName = new Map(floors.map((f) => [f.name.toLowerCase(), f]));
  const floorByCode = new Map(floors.map((f) => [f.code.toLowerCase(), f]));
  const byCode = new Map(existing.map((t) => [t.code.toUpperCase(), t]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const floorName = (r["Floor"] ?? "").trim();
      const number = (r["Number"] ?? "").trim();
      const code = (r["Code"] ?? "").trim() || number.toUpperCase();
      if (!floorName || !number || !code) {
        skipped++;
        errors.push(`${line}: Floor, Number and Code are required`);
        continue;
      }

      const floor =
        floorByName.get(floorName.toLowerCase()) ?? floorByCode.get(floorName.toLowerCase());
      if (!floor) {
        skipped++;
        errors.push(`${line}: unknown floor "${floorName}" — import floors first`);
        continue;
      }

      const capacity = parseNumber(r["Capacity"] ?? "");
      if (capacity === undefined || capacity < 1) {
        skipped++;
        errors.push(`${line}: Capacity must be a positive number`);
        continue;
      }

      const shapeRaw = (r["Shape"] ?? "").trim().toLowerCase();
      const shape: RestaurantTable["shape"] =
        shapeRaw === "round" ||
        shapeRaw === "rectangle" ||
        shapeRaw === "triangle" ||
        shapeRaw === "ellipse" ||
        shapeRaw === "half_circle"
          ? shapeRaw
          : "square";
      const allowsSharing = r["Sharing"] === "" ? undefined : parseYesNo(r["Sharing"]);
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = {
        floor_id: floor.id,
        number,
        code,
        capacity,
        shape,
      };
      if (allowsSharing !== undefined) payload.allows_sharing = allowsSharing;
      if (isActive !== undefined) payload.is_active = isActive;

      const hit = byCode.get(code.toUpperCase());
      if (hit) {
        await updateTable(hit.id, payload);
        updated++;
      } else {
        await createTable(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

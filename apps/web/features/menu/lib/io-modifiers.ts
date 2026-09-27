import {
  createModifier,
  createModifierGroup,
  getModifierGroups,
  getModifiers,
  updateModifier,
  updateModifierGroup,
} from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseNumber, parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { Modifier, ModifierGroup } from "../api/types";

// --- Modifier groups ---

export const modifierGroupColumns: CsvColumn<ModifierGroup>[] = [
  { key: "name", label: "Name", required: true, get: (g) => g.name },
  { key: "required", label: "Required", get: (g) => g.min_selection > 0 },
  { key: "min_selection", label: "Min", get: (g) => g.min_selection },
  { key: "max_selection", label: "Max", get: (g) => g.max_selection },
  { key: "active", label: "Active", get: (g) => g.is_active },
];

export const modifierGroupSample: Record<string, string>[] = [
  {
    name: "Spice Level",
    required: "yes",
    min_selection: "1",
    max_selection: "1",
    active: "yes",
  },
  {
    name: "Toppings",
    required: "no",
    min_selection: "0",
    max_selection: "3",
    active: "yes",
  },
];

/**
 * Bulk upsert modifier groups matched by name.
 */
export async function importModifierGroups(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getModifierGroups();
  const byName = new Map(existing.map((g) => [g.name.toLowerCase(), g]));
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
      const required = parseYesNo(r["Required"] ?? "");
      const min = parseNumber(r["Min"] ?? "") ?? (required ? 1 : 0);
      const max = parseNumber(r["Max"] ?? "") ?? (required ? 1 : 3);
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = {
        name,
        selection_type: max === 1 ? "single" : "multiple",
        min_selection: min,
        max_selection: max,
      };
      if (isActive !== undefined) payload.is_active = isActive;

      const hit = byName.get(name.toLowerCase());
      if (hit) {
        await updateModifierGroup(hit.id, payload);
        updated++;
      } else {
        const group = await createModifierGroup(payload);
        if (isActive === false) {
          await updateModifierGroup(group.id, { is_active: false });
        }
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

// --- Modifier options ---

export const modifierColumns = (groupNameById: Map<string, string>): CsvColumn<Modifier>[] => [
  {
    key: "group",
    label: "Group",
    required: true,
    get: (m) => groupNameById.get(m.modifier_group_id) ?? m.modifier_group_id,
  },
  { key: "name", label: "Name", required: true, get: (m) => m.name },
  { key: "price", label: "Price", get: (m) => m.price },
  { key: "active", label: "Active", get: (m) => m.is_active },
];

export const modifierSample: Record<string, string>[] = [
  {
    group: "Spice Level",
    name: "Less Spicy",
    price: "0",
    active: "yes",
  },
  {
    group: "Toppings",
    name: "Extra Cheese",
    price: "30",
    active: "yes",
  },
];

/**
 * Bulk upsert modifier options matched by group + option name.
 * New options are appended to the group.
 */
export async function importModifiers(rows: Record<string, string>[]): Promise<ImportResult> {
  const [groups, existing] = await Promise.all([getModifierGroups(), getModifiers()]);
  const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
  const byKey = new Map(existing.map((m) => [`${m.modifier_group_id}|${m.name.toLowerCase()}`, m]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const groupName = (r["Group"] ?? "").trim();
      const name = (r["Name"] ?? "").trim();
      if (!groupName || !name) {
        skipped++;
        errors.push(`${line}: Group and Name are required`);
        continue;
      }
      const group = groupByName.get(groupName.toLowerCase());
      if (!group) {
        skipped++;
        errors.push(`${line}: unknown group "${groupName}" — import groups first`);
        continue;
      }
      const price = parseNumber(r["Price"] ?? "") ?? 0;
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const key = `${group.id}|${name.toLowerCase()}`;
      const hit = byKey.get(key);
      if (hit) {
        const payload: any = {};
        if (price !== hit.price) payload.price = price;
        if (isActive !== undefined && isActive !== hit.is_active) payload.is_active = isActive;
        if (Object.keys(payload).length > 0) {
          await updateModifier(hit.id, payload);
        }
        updated++;
      } else {
        const mod = await createModifier({
          modifier_group_id: group.id,
          name,
          price,
        });
        if (isActive === false) {
          await updateModifier(mod.id, { is_active: false });
        }
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

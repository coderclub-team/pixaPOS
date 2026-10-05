import { createCustomer, getCustomers, updateCustomer } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { CustomerWithDerived } from "../api/types";

export const customerColumns: CsvColumn<CustomerWithDerived>[] = [
  { key: "name", label: "Name", required: true, get: (c) => c.name },
  { key: "phone", label: "Phone", required: true, get: (c) => c.phone },
  { key: "email", label: "Email", get: (c) => c.email ?? "" },
  { key: "city", label: "City", get: (c) => c.primary_address?.city ?? "" },
  { key: "tags", label: "Tags", get: (c) => c.tags.join(";") },
  { key: "active", label: "Active", get: (c) => c.is_active },
];

export const customerSample: Record<string, string>[] = [
  {
    name: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com",
    city: "Ahmedabad",
    tags: "regular;delivery",
    active: "yes",
  },
  {
    name: "Priya Patel",
    phone: "9876543211",
    email: "",
    city: "Surat",
    tags: "vip",
    active: "yes",
  },
];

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

/**
 * Bulk upsert customers matched by phone (normalized), falling back to name.
 */
export async function importCustomers(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getCustomers();
  const byPhone = new Map(existing.map((c) => [normalizePhone(c.phone), c]));
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      const phone = normalizePhone((r["Phone"] ?? "").trim());
      if (!name || !phone) {
        skipped++;
        errors.push(`${line}: Name and Phone are required`);
        continue;
      }

      const email = (r["Email"] ?? "").trim() || undefined;
      const city = (r["City"] ?? "").trim();
      const tags = (r["Tags"] ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = { name, phone };
      if (email) payload.email = email;
      if (tags.length > 0) payload.tags = tags;
      if (isActive !== undefined) payload.is_active = isActive;
      if (city) {
        payload.addresses = [
          {
            label: "home",
            line1: "",
            locality: "",
            city,
            state: "",
            postal_code: "",
            country: "IN",
            is_primary: true,
          },
        ];
      }

      const hit = byPhone.get(phone) ?? byName.get(name.toLowerCase());
      if (hit) {
        await updateCustomer(hit.id, payload);
        updated++;
      } else {
        await createCustomer(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

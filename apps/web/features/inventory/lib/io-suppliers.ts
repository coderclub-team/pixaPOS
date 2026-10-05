import { createSupplier, getSuppliers, updateSupplier } from "../api/service";
import type { CsvColumn } from "@/features/system/lib/csv";
import { parseYesNo } from "@/features/system/lib/csv";
import type { ImportResult } from "@/features/system/components/io-dialog";
import type { Supplier } from "../api/types";

export const supplierColumns: CsvColumn<Supplier>[] = [
  { key: "name", label: "Name", required: true, get: (s) => s.name },
  { key: "phone", label: "Phone", required: true, get: (s) => s.phone },
  { key: "contact_person", label: "Contact Person", get: (s) => s.contact_person ?? "" },
  { key: "gstin", label: "GSTIN", get: (s) => s.gstin ?? "" },
  { key: "email", label: "Email", get: (s) => s.email ?? "" },
  { key: "address", label: "Address", get: (s) => s.address ?? "" },
  { key: "active", label: "Active", get: (s) => s.is_active },
];

export const supplierSample: Record<string, string>[] = [
  {
    name: "Shree Grains",
    phone: "9876543001",
    contact_person: "Ramesh Patel",
    gstin: "24ABCDE1234F1Z5",
    email: "shree@supplier.com",
    address: "APMC Market, Ahmedabad",
    active: "yes",
  },
  {
    name: "Fresh Meat Co",
    phone: "9876543002",
    contact_person: "Arjun Singh",
    gstin: "24FGHIJ5678K1Z5",
    email: "fresh@meat.com",
    address: "Meat Market, Ahmedabad",
    active: "yes",
  },
];

/**
 * Bulk upsert suppliers matched by phone, falling back to name.
 */
export async function importSuppliers(rows: Record<string, string>[]): Promise<ImportResult> {
  const existing = await getSuppliers();
  const byPhone = new Map(existing.map((s) => [s.phone, s]));
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = `Row ${i + 2}`;
    try {
      const name = (r["Name"] ?? "").trim();
      const phone = (r["Phone"] ?? "").trim();
      if (!name || !phone) {
        skipped++;
        errors.push(`${line}: Name and Phone are required`);
        continue;
      }

      const contactPerson = (r["Contact Person"] ?? "").trim() || undefined;
      const gstin = (r["GSTIN"] ?? "").trim() || undefined;
      const email = (r["Email"] ?? "").trim() || undefined;
      const address = (r["Address"] ?? "").trim() || undefined;
      const isActive = r["Active"] === "" ? undefined : parseYesNo(r["Active"]);

      const payload: any = { name, phone };
      if (contactPerson) payload.contact_person = contactPerson;
      if (gstin) payload.gstin = gstin;
      if (email) payload.email = email;
      if (address) payload.address = address;
      if (isActive !== undefined) payload.is_active = isActive;

      const hit = byPhone.get(phone) ?? byName.get(name.toLowerCase());
      if (hit) {
        await updateSupplier(hit.id, payload);
        updated++;
      } else {
        await createSupplier(payload);
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, updated, skipped, errors };
}

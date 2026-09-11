import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import type {
  AddressPayload,
  Customer,
  CustomerAddress,
  CustomerFilters,
  CustomerPayload,
  CustomerWithDerived,
} from "./types";

const CUSTOMER_STORAGE_KEY = "pixaCustomers";

let mockCustomers: Customer[] = [];

function saveCustomers() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ customers: mockCustomers }));
    } catch {}
  }
}

function loadCustomers(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.customers)) mockCustomers = parsed.customers;
      }
    } catch {}
  }
}
loadCustomers();

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

function buildAddress(payload: AddressPayload, isPrimary: boolean): CustomerAddress {
  return {
    id: `adr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    label: payload.label ?? "home",
    line1: payload.line1?.trim() ?? "",
    line2: payload.line2?.trim() || undefined,
    locality: payload.locality?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    state: payload.state?.trim() ?? "",
    postal_code: payload.postal_code?.trim() ?? "",
    country: payload.country?.trim() || "IN",
    latitude: payload.latitude,
    longitude: payload.longitude,
    is_primary: isPrimary,
  };
}

/** Exactly one primary: the flagged one wins, else the first. */
function normalizeAddresses(payloads: AddressPayload[]): CustomerAddress[] {
  const flagged = payloads.findIndex((p) => p.is_primary);
  return payloads.map((p, i) =>
    buildAddress(p, flagged >= 0 ? i === flagged : i === 0),
  );
}

type OrderStat = { count: number; spent: number; last: string };

async function orderStatsByCustomer(outletId: string): Promise<Map<string, OrderStat>> {
  // Dynamic import: orders/service already imports this module (getCustomerById).
  const { getOrders } = await import("@/features/orders/api/service");
  const map = new Map<string, OrderStat>();
  try {
    const orders = await getOrders({ outlet_id: outletId });
    for (const o of orders) {
      if (!o.customer_id) continue;
      const prev = map.get(o.customer_id) ?? { count: 0, spent: 0, last: "" };
      map.set(o.customer_id, {
        count: prev.count + 1,
        spent: prev.spent + o.total_paise,
        last: o.created_at > prev.last ? o.created_at : prev.last,
      });
    }
  } catch {
    // Orders read-model unavailable — stats stay zero, record still loads.
  }
  return map;
}

function enrichCustomer(c: Customer, stats?: Map<string, OrderStat>): CustomerWithDerived {
  const s = stats?.get(c.id);
  return {
    ...c,
    orders_count: s?.count ?? 0,
    total_spent_paise: s?.spent ?? 0,
    last_order_at: s?.last || undefined,
    primary_address: c.addresses.find((a) => a.is_primary),
  };
}

function assertUniquePhone(outletId: string, phone: string, exceptId?: string) {
  const dup = mockCustomers.some(
    (c) =>
      !c.deleted_at &&
      c.outlet_id === outletId &&
      normalizePhone(c.phone) === normalizePhone(phone) &&
      c.id !== exceptId,
  );
  if (dup) throw new Error(`A customer with phone "${phone}" already exists in this outlet`);
}

export async function getCustomers(filters?: CustomerFilters): Promise<CustomerWithDerived[]> {
  await delay(300);
  let r = [...mockCustomers].filter((c) => !c.deleted_at);
  if (filters?.outlet_id) r = r.filter((c) => c.outlet_id === filters.outlet_id);
  if (filters?.tag) r = r.filter((c) => c.tags.includes(filters.tag!));
  if (filters?.is_active !== undefined) r = r.filter((c) => c.is_active === filters.is_active);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(filters.search!) ||
        c.email?.toLowerCase().includes(q),
    );
  }
  const stats = await orderStatsByCustomer(filters?.outlet_id ?? "out_001");
  return r.sort((a, b) => a.name.localeCompare(b.name)).map((c) => enrichCustomer(c, stats));
}

export async function getCustomerById(id: string): Promise<CustomerWithDerived | null> {
  await delay(200);
  const c = mockCustomers.find((c) => c.id === id && !c.deleted_at);
  if (!c) return null;
  const stats = await orderStatsByCustomer(c.outlet_id);
  return enrichCustomer(c, stats);
}

export async function findCustomerByPhone(
  phone: string,
  outletId = "out_001",
): Promise<CustomerWithDerived | null> {
  await delay(200);
  const c = mockCustomers.find(
    (c) => !c.deleted_at && c.outlet_id === outletId && normalizePhone(c.phone) === normalizePhone(phone),
  );
  return c ? enrichCustomer(c) : null;
}

export async function createCustomer(payload: CustomerPayload & { outlet_id?: string }): Promise<CustomerWithDerived> {
  const release = await entityMutex.acquire("customer-write");
  try {
    await delay(400);
    const outletId = payload.outlet_id ?? "out_001";
    if (!payload.name?.trim()) throw new Error("Customer name is required");
    if (!normalizePhone(payload.phone ?? "")) throw new Error("Customer phone is required");
    assertUniquePhone(outletId, payload.phone);

    const now = new Date().toISOString();
    const customer: Customer = {
      id: `cus_${Date.now().toString(36)}`,
      outlet_id: outletId,
      name: payload.name.trim(),
      phone: normalizePhone(payload.phone),
      alternate_phone: payload.alternate_phone?.trim() || undefined,
      email: payload.email?.trim() || undefined,
      tags: payload.tags ?? [],
      notes: payload.notes?.trim() || undefined,
      is_active: payload.is_active ?? true,
      addresses: normalizeAddresses(payload.addresses ?? []),
      version: 1,
      created_at: now,
      updated_at: now,
    };
    mockCustomers.push(customer);
    saveCustomers();
    await recordEvent({
      outlet_id: customer.outlet_id,
      entity_type: "CUSTOMER",
      entity_id: customer.id,
      event_type: "CUSTOMER_CREATED",
      actor_id: "staff",
    });
    return enrichCustomer(customer, await orderStatsByCustomer(customer.outlet_id));
  } finally {
    release();
  }
}

export async function updateCustomer(
  id: string,
  payload: CustomerPayload & { outlet_id?: string },
): Promise<CustomerWithDerived> {
  const release = await entityMutex.acquire(`customer-${id}`);
  try {
    await delay(400);
    const idx = mockCustomers.findIndex((c) => c.id === id && !c.deleted_at);
    if (idx === -1) throw new Error("Customer not found");
    const current = mockCustomers[idx];
    if (payload.outlet_id !== undefined && payload.outlet_id !== current.outlet_id) {
      throw new Error("Customer cannot move across outlets");
    }
    if (payload.phone !== undefined) {
      if (!normalizePhone(payload.phone)) throw new Error("Customer phone is required");
      assertUniquePhone(current.outlet_id, payload.phone, id);
    }
    const updated: Customer = {
      ...current,
      name: payload.name?.trim() ?? current.name,
      phone: payload.phone !== undefined ? normalizePhone(payload.phone) : current.phone,
      alternate_phone: payload.alternate_phone?.trim() || undefined,
      email: payload.email?.trim() || undefined,
      tags: payload.tags ?? current.tags,
      notes: payload.notes?.trim() || undefined,
      is_active: payload.is_active ?? current.is_active,
      addresses:
        payload.addresses !== undefined ? normalizeAddresses(payload.addresses) : current.addresses,
      updated_at: new Date().toISOString(),
      version: current.version + 1,
    };
    mockCustomers[idx] = updated;
    saveCustomers();
    await recordEvent({
      outlet_id: current.outlet_id,
      entity_type: "CUSTOMER",
      entity_id: id,
      event_type: "CUSTOMER_UPDATED",
      actor_id: "staff",
    });
    return enrichCustomer(updated, await orderStatsByCustomer(updated.outlet_id));
  } finally {
    release();
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const release = await entityMutex.acquire(`customer-${id}`);
  try {
    await delay(300);
    const idx = mockCustomers.findIndex((c) => c.id === id && !c.deleted_at);
    if (idx === -1) throw new Error("Customer not found");
    mockCustomers[idx] = {
      ...mockCustomers[idx],
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
      version: mockCustomers[idx].version + 1,
    };
    saveCustomers();
    await recordEvent({
      outlet_id: mockCustomers[idx].outlet_id,
      entity_type: "CUSTOMER",
      entity_id: id,
      event_type: "CUSTOMER_DELETED",
      actor_id: "staff",
    });
  } finally {
    release();
  }
}

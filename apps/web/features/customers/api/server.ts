/**
 * Customers domain — server implementation (Postgres-backed via Drizzle).
 *
 * Scoped to organization + outlet. History-safe: deletes are soft (`deleted_at`).
 * Emits append-only business events (CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_DELETED).
 * Server-only: import from route handlers and server actions, never client bundles.
 */
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import { db, customers, orders } from "@pixa/db";
import { recordServerEvent } from "@/features/events/api/server";
import type {
  Customer,
  CustomerAddress,
  CustomerFilters,
  CustomerPayload,
  CustomerWithDerived,
} from "./types";

function toAddress(raw: unknown): CustomerAddress {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ulid()),
    label: (r.label as CustomerAddress["label"]) ?? "home",
    line1: String(r.line1 ?? ""),
    line2: typeof r.line2 === "string" ? r.line2 : undefined,
    locality: String(r.locality ?? ""),
    city: String(r.city ?? ""),
    state: String(r.state ?? ""),
    postal_code: String(r.postal_code ?? ""),
    country: String(r.country ?? "India"),
    latitude: typeof r.latitude === "number" ? r.latitude : undefined,
    longitude: typeof r.longitude === "number" ? r.longitude : undefined,
    is_primary: Boolean(r.is_primary),
  };
}

function rowToCustomer(row: Record<string, unknown>): Customer {
  const rawAddresses = Array.isArray(row.addresses) ? row.addresses : [];
  const addresses = rawAddresses.map(toAddress);
  const rawTags = Array.isArray(row.tags) ? (row.tags as string[]) : [];

  return {
    id: String(row.id),
    outlet_id: String(row.outletId ?? row.outlet_id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    alternate_phone: typeof row.alternatePhone === "string" ? row.alternatePhone : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    tags: rawTags,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    is_active: row.isActive !== false && row.is_active !== false,
    addresses,
    version: Number(row.version ?? 1),
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    updated_at:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
    deleted_at:
      row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : typeof row.deletedAt === "string"
          ? row.deletedAt
          : null,
  };
}

export async function listCustomers(
  organizationId: string,
  outletId: string,
  filters?: CustomerFilters,
): Promise<CustomerWithDerived[]> {
  const conditions = [
    eq(customers.organizationId, organizationId),
    eq(customers.outletId, outletId),
    isNull(customers.deletedAt),
  ];

  if (filters?.is_active !== undefined) {
    conditions.push(eq(customers.isActive, filters.is_active));
  }

  const baseRows = (await db()
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt))) as unknown as Record<string, unknown>[];

  // Client-level filters: search & tag
  let mapped = baseRows.map(rowToCustomer);

  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    mapped = mapped.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }

  if (filters?.tag) {
    mapped = mapped.filter((c) => c.tags.includes(filters.tag!));
  }

  if (mapped.length === 0) return [];

  const statsMap = new Map<
    string,
    { orders_count: number; total_spent_paise: number; last_order_at?: string }
  >();

  try {
    const customerIds = mapped.map((c) => c.id);
    const statsRows = await db()
      .select({
        customerId: orders.customerId,
        ordersCount: sql<number>`count(${orders.id})::int`,
        totalSpentPaise: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)::bigint`,
        lastOrderAt: sql<string>`max(${orders.createdAt})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.outletId, outletId),
          isNull(orders.deletedAt),
          inArray(orders.customerId, customerIds),
        ),
      )
      .groupBy(orders.customerId);

    for (const s of statsRows) {
      if (s.customerId) {
        statsMap.set(s.customerId, {
          orders_count: Number(s.ordersCount ?? 0),
          total_spent_paise: Number(s.totalSpentPaise ?? 0),
          last_order_at: s.lastOrderAt ? new Date(s.lastOrderAt).toISOString() : undefined,
        });
      }
    }
  } catch {
    // Orders table might be empty or unmigrated; non-fatal
  }

  return mapped.map((c) => {
    const stats = statsMap.get(c.id) ?? { orders_count: 0, total_spent_paise: 0 };
    const primary_address = c.addresses.find((a) => a.is_primary) ?? c.addresses[0];
    return {
      ...c,
      ...stats,
      primary_address,
    };
  });
}

export async function getCustomerById(
  organizationId: string,
  id: string,
): Promise<CustomerWithDerived | null> {
  const rows = (await db()
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.id, id),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1)) as unknown as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  const customer = rowToCustomer(row);

  // Compute stats
  let ordersCount = 0;
  let totalSpentPaise = 0;
  let lastOrderAt: string | undefined;

  try {
    const statsRows = await db()
      .select({
        ordersCount: sql<number>`count(${orders.id})::int`,
        totalSpentPaise: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)::bigint`,
        lastOrderAt: sql<string>`max(${orders.createdAt})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.customerId, id),
          isNull(orders.deletedAt),
        ),
      );

    const stats = statsRows[0];
    if (stats) {
      ordersCount = Number(stats.ordersCount ?? 0);
      totalSpentPaise = Number(stats.totalSpentPaise ?? 0);
      lastOrderAt = stats.lastOrderAt ? new Date(stats.lastOrderAt).toISOString() : undefined;
    }
  } catch {
    // Non-fatal
  }

  const primary_address = customer.addresses.find((a) => a.is_primary) ?? customer.addresses[0];

  return {
    ...customer,
    orders_count: ordersCount,
    total_spent_paise: totalSpentPaise,
    last_order_at: lastOrderAt,
    primary_address,
  };
}

export async function createCustomer(
  organizationId: string,
  outletId: string,
  payload: CustomerPayload,
  by = "staff",
): Promise<Customer> {
  const cleanPhone = (payload.phone ?? "").trim();
  const cleanName = (payload.name ?? "").trim();
  if (!cleanName) throw new Error("Customer name is required");
  if (!cleanPhone) throw new Error("Phone number is required");

  // Phone uniqueness per outlet
  const dup = await db()
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.outletId, outletId),
        eq(customers.phone, cleanPhone),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  if (dup.length > 0) {
    throw new Error(`Customer with phone ${cleanPhone} already exists`);
  }

  const id = ulid();
  const now = new Date();
  const normalizedAddresses = (payload.addresses ?? []).map((a, idx) => ({
    id: ulid(),
    label: a.label ?? "home",
    line1: a.line1 ?? "",
    line2: a.line2 ?? null,
    locality: a.locality ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    postal_code: a.postal_code ?? "",
    country: a.country ?? "India",
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    is_primary: a.is_primary ?? idx === 0,
  }));

  const [row] = (await db()
    .insert(customers)
    .values({
      id,
      organizationId,
      outletId,
      name: cleanName,
      phone: cleanPhone,
      alternatePhone: payload.alternate_phone?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      tags: payload.tags ?? [],
      notes: payload.notes?.trim() || null,
      isActive: payload.is_active !== false,
      addresses: normalizedAddresses,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning()) as unknown as Record<string, unknown>[];

  await recordServerEvent({
    outlet_id: outletId,
    organization_id: organizationId,
    entity_type: "CUSTOMER",
    entity_id: id,
    event_type: "CUSTOMER_CREATED",
    actor_id: by,
    metadata: { phone: cleanPhone, name: cleanName },
  });

  return rowToCustomer(row);
}

export async function updateCustomer(
  organizationId: string,
  id: string,
  payload: Partial<CustomerPayload>,
  by = "staff",
): Promise<Customer> {
  const existing = await getCustomerById(organizationId, id);
  if (!existing) throw new Error("Customer not found");

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    version: existing.version + 1,
  };

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw new Error("Customer name cannot be empty");
    updates.name = name;
  }

  if (payload.phone !== undefined) {
    const phone = payload.phone.trim();
    if (!phone) throw new Error("Phone number cannot be empty");
    if (phone !== existing.phone) {
      const dup = await db()
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.outletId, existing.outlet_id),
            eq(customers.phone, phone),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);
      if (dup.length > 0 && dup[0].id !== id) {
        throw new Error(`Customer with phone ${phone} already exists`);
      }
    }
    updates.phone = phone;
  }

  if (payload.alternate_phone !== undefined) {
    updates.alternatePhone = payload.alternate_phone.trim() || null;
  }

  if (payload.email !== undefined) {
    updates.email = payload.email.trim().toLowerCase() || null;
  }

  if (payload.tags !== undefined) {
    updates.tags = payload.tags;
  }

  if (payload.notes !== undefined) {
    updates.notes = payload.notes.trim() || null;
  }

  if (payload.is_active !== undefined) {
    updates.isActive = payload.is_active;
  }

  if (payload.addresses !== undefined) {
    updates.addresses = payload.addresses.map((a, idx) => ({
      id: ("id" in a && typeof a.id === "string" ? a.id : null) ?? ulid(),
      label: a.label ?? "home",
      line1: a.line1 ?? "",
      line2: a.line2 ?? null,
      locality: a.locality ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      postal_code: a.postal_code ?? "",
      country: a.country ?? "India",
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      is_primary: a.is_primary ?? idx === 0,
    }));
  }

  const [row] = (await db()
    .update(customers)
    .set(updates)
    .where(and(eq(customers.organizationId, organizationId), eq(customers.id, id)))
    .returning()) as unknown as Record<string, unknown>[];

  await recordServerEvent({
    outlet_id: existing.outlet_id,
    organization_id: organizationId,
    entity_type: "CUSTOMER",
    entity_id: id,
    event_type: "CUSTOMER_UPDATED",
    actor_id: by,
    metadata: { changed: Object.keys(updates) },
  });

  return rowToCustomer(row);
}

export async function deleteCustomer(
  organizationId: string,
  id: string,
  by = "staff",
): Promise<void> {
  const existing = await getCustomerById(organizationId, id);
  if (!existing) return;

  await db()
    .update(customers)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(and(eq(customers.organizationId, organizationId), eq(customers.id, id)));

  await recordServerEvent({
    outlet_id: existing.outlet_id,
    organization_id: organizationId,
    entity_type: "CUSTOMER",
    entity_id: id,
    event_type: "CUSTOMER_DELETED",
    actor_id: by,
    metadata: { phone: existing.phone, name: existing.name },
  });
}

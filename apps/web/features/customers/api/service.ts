/**
 * Customers domain — client service (server-backed).
 *
 * Thin fetch layer over /api/customers*. Same exported API as the old
 * localStorage version so all callers (customer form, list, order panel)
 * work unchanged. The server is the single source of truth — no mock data,
 * no local persistence.
 */
import { getServiceOutletId } from "@/features/outlet/api/outlets";
import type { Customer, CustomerFilters, CustomerPayload, CustomerWithDerived } from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** No-op in server-backed architecture. Kept for caller compatibility. */
export async function hydrateCustomersFromMirror(): Promise<void> {
  // Server-backed: no local mirror
}

export async function getCustomers(filters?: CustomerFilters): Promise<CustomerWithDerived[]> {
  const outletId = filters?.outlet_id ?? getServiceOutletId();
  if (!outletId) return [];

  const { customers } = await api<{ customers: CustomerWithDerived[] }>(
    `/api/customers${toQuery({
      outlet_id: outletId,
      search: filters?.search,
      tag: filters?.tag,
      is_active: filters?.is_active,
    })}`,
  );
  return customers ?? [];
}

export async function getCustomerById(id: string): Promise<CustomerWithDerived | null> {
  try {
    const { customer } = await api<{ customer: CustomerWithDerived | null }>(
      `/api/customers/${encodeURIComponent(id)}`,
    );
    return customer ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function findCustomerByPhone(
  phone: string,
  outletId?: string,
): Promise<Customer | null> {
  const resolvedOutlet = outletId ?? getServiceOutletId();
  if (!resolvedOutlet) return null;
  const list = await getCustomers({ search: phone.trim(), outlet_id: resolvedOutlet });
  const clean = phone.replace(/[\s-]/g, "");
  return list.find((c) => c.phone.replace(/[\s-]/g, "") === clean) ?? null;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const outletId = payload.outlet_id ?? getServiceOutletId();
  if (!outletId) throw new Error("No active outlet selected");

  const { customer } = await api<{ customer: Customer }>("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  return customer;
}

export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>,
): Promise<Customer> {
  const { customer } = await api<{ customer: Customer }>(
    `/api/customers/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

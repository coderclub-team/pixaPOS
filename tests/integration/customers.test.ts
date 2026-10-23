/**
 * Integration: customers domain against the isolated test database.
 * Auth boundary stubbed (admin); persistence, duplicate checks, and soft delete are real.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockBaSession, mockBaOrgId, mockBaHas } = vi.hoisted(() => ({
  mockBaSession: vi.fn(),
  mockBaOrgId: vi.fn(),
  mockBaHas: vi.fn(),
}));
vi.mock("@pixa/server", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    baSession: mockBaSession,
    baOrgId: mockBaOrgId,
    baHas: mockBaHas,
    baUser: vi.fn(async () => null),
    baMemberRole: vi.fn(async () => null),
    requireBaUser: vi.fn(async () => {
      throw new Error("redirect");
    }),
  };
});
vi.mock("@pixa/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { getTestDb } = await import("../helpers/db");
  return { ...original, db: () => getTestDb() };
});

import { GET as listCustomers, POST as createCustomer } from "@/app/api/customers/route";
import {
  DELETE as deleteCustomer,
  GET as getCustomer,
  PUT as updateCustomer,
} from "@/app/api/customers/[id]/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baOrganization, baUser, outlets } from "@pixa/db";

const ORG = "org_customers_test";
let OUTLET = "";

async function authedAdmin() {
  const database = getTestDb();
  const userId = testId("user");
  await database
    .insert(baUser)
    .values({
      id: userId,
      name: "Admin User",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  mockBaSession.mockResolvedValue({
    session: { id: testId("sess"), userId },
    user: { id: userId, email: `${userId}@example.com` },
  });
  mockBaOrgId.mockResolvedValue(ORG);
  mockBaHas.mockResolvedValue(true);
}

function req(url: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, init);
}

describe("Customers API (integration)", () => {
  beforeAll(async () => {
    await resetTestDb();
    const database = getTestDb();
    await database
      .insert(baOrganization)
      .values({
        id: ORG,
        name: "Test Restaurant Corp",
        slug: "test-corp",
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    OUTLET = testId("outlet");
    await database
      .insert(outlets)
      .values({
        id: OUTLET,
        organizationId: ORG,
        name: "Downtown Branch",
        code: "DT01",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await authedAdmin();
  });

  it("creates a customer and retrieves it in the outlet customer list", async () => {
    const postRes = await createCustomer(
      req(`/api/customers?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "John Doe",
          phone: "9876543210",
          email: "john@example.com",
          tags: ["vip", "regular"],
          notes: "Prefers window seating",
          addresses: [
            {
              label: "home",
              line1: "123 Main St",
              locality: "Central",
              city: "Chennai",
              state: "Tamil Nadu",
              postal_code: "600001",
              country: "India",
              is_primary: true,
            },
          ],
        }),
      }),
    );

    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.customer.name).toBe("John Doe");
    expect(postJson.customer.phone).toBe("9876543210");
    expect(postJson.customer.email).toBe("john@example.com");
    expect(postJson.customer.tags).toEqual(["vip", "regular"]);
    expect(postJson.customer.addresses).toHaveLength(1);

    const customerId = postJson.customer.id;

    // Retrieve via list
    const listRes = await listCustomers(req(`/api/customers?outlet_id=${OUTLET}`));
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    const found = listJson.customers.find((c: { id: string }) => c.id === customerId);
    expect(found).toBeDefined();
    expect(found.orders_count).toBe(0);
    expect(found.total_spent_paise).toBe(0);

    // Retrieve via single GET
    const getRes = await getCustomer(req(`/api/customers/${customerId}`), {
      params: Promise.resolve({ id: customerId }),
    });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.customer.id).toBe(customerId);
  });

  it("rejects duplicate customer phone within the same outlet", async () => {
    const res = await createCustomer(
      req(`/api/customers?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jane Doe",
          phone: "9876543210", // already used by John Doe above
        }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it("updates an existing customer's details", async () => {
    // Create customer to update
    const postRes = await createCustomer(
      req(`/api/customers?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bob Smith",
          phone: "9123456780",
        }),
      }),
    );
    const { customer } = await postRes.json();

    const putRes = await updateCustomer(
      req(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Robert Smith",
          notes: "Updated preferences",
        }),
      }),
      { params: Promise.resolve({ id: customer.id }) },
    );

    expect(putRes.status).toBe(200);
    const updated = (await putRes.json()).customer;
    expect(updated.name).toBe("Robert Smith");
    expect(updated.notes).toBe("Updated preferences");
    expect(updated.version).toBe(2);
  });

  it("soft deletes a customer", async () => {
    const postRes = await createCustomer(
      req(`/api/customers?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Doomed Customer",
          phone: "9000000001",
        }),
      }),
    );
    const { customer } = await postRes.json();

    const delRes = await deleteCustomer(req(`/api/customers/${customer.id}`), {
      params: Promise.resolve({ id: customer.id }),
    });
    expect(delRes.status).toBe(200);

    // Should no longer appear in GET
    const getRes = await getCustomer(req(`/api/customers/${customer.id}`), {
      params: Promise.resolve({ id: customer.id }),
    });
    expect(getRes.status).toBe(404);
  });
});

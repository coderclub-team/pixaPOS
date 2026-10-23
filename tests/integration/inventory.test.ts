/**
 * Integration: inventory domain against the isolated test database.
 * Tests materials, suppliers, purchase orders, purchases, stock ledger, and wastage.
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

import { POST as createMaster } from "@/app/api/masters/[type]/route";
import { GET as listPOs, POST as createPO } from "@/app/api/inventory/purchase-orders/route";
import { GET as listPurchases, POST as createPurchase } from "@/app/api/inventory/purchases/route";
import { GET as listWaste, POST as createWaste } from "@/app/api/inventory/waste/route";
import { GET as getLedger } from "@/app/api/inventory/ledger/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baOrganization, baUser, outlets, rawMaterials } from "@pixa/db";
import { eq } from "drizzle-orm";

const ORG = "org_inventory_test";
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

describe("Inventory API (integration)", () => {
  beforeAll(async () => {
    await resetTestDb();
    const database = getTestDb();
    await database
      .insert(baOrganization)
      .values({
        id: ORG,
        name: "Inventory Test Org",
        slug: "inventory-test",
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    OUTLET = testId("outlet");
    await database
      .insert(outlets)
      .values({
        id: OUTLET,
        organizationId: ORG,
        name: "Central Kitchen",
        code: "CK01",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await authedAdmin();
  });

  it("creates a supplier and raw material via masters API", async () => {
    const supRes = await createMaster(
      req(`/api/masters/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Fresh Farms Dairy",
          phone: "9876543210",
          contact_person: "Ramesh",
        }),
      }),
      { params: Promise.resolve({ type: "suppliers" }) },
    );
    expect(supRes.status).toBe(201);
    const { id: supId } = await supRes.json();
    expect(supId).toBeDefined();

    const matRes = await createMaster(
      req(`/api/masters/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Whole Milk",
          sku: "MILK-001",
          unit: "l",
          supplier_id: supId,
          cost_price_paise: 5000, // ₹50.00
          stock_qty: "0",
        }),
      }),
      { params: Promise.resolve({ type: "materials" }) },
    );
    expect(matRes.status).toBe(201);
    const { id: matId } = await matRes.json();
    expect(matId).toBeDefined();
  });

  it("creates a purchase order and records an inward purchase, updating stock", async () => {
    const db = getTestDb();
    const [mat] = await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.sku, "MILK-001"))
      .limit(1);

    // 1. Create Purchase Order
    const poRes = await createPO(
      req(`/api/inventory/purchase-orders?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: mat.supplierId,
          items: [
            {
              material_id: mat.id,
              qty: 50,
              unit: "l",
              unit_cost: 50,
            },
          ],
        }),
      }),
    );
    expect(poRes.status).toBe(201);
    const po = (await poRes.json()).order;
    expect(po.total).toBe(2500);

    // 2. Record Inward Purchase (Goods Receipt)
    const purRes = await createPurchase(
      req(`/api/inventory/purchases?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_order_id: po.id,
          supplier_id: mat.supplierId,
          items: [
            {
              material_id: mat.id,
              qty: 50,
              unit: "l",
              unit_cost: 52, // slight cost inflation to test average
            },
          ],
          paid_amount: 2600,
        }),
      }),
    );
    expect(purRes.status).toBe(201);
    const pur = (await purRes.json()).purchase;
    expect(pur.total).toBe(2600);
    expect(pur.payment_status).toBe("paid");

    // Verify raw material stock updated in database
    const [updatedMat] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, mat.id));
    expect(Number(updatedMat.stockQty)).toBe(50);
    expect(Number(updatedMat.avgCostPaise)).toBe(5200); // 5200 paise = ₹52
  });

  it("logs wastage, deducts stock, and records in stock ledger", async () => {
    const db = getTestDb();
    const [mat] = await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.sku, "MILK-001"))
      .limit(1);

    // 1. Create Waste Log
    const wasteRes = await createWaste(
      req(`/api/inventory/waste?outlet_id=${OUTLET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: mat.id,
          qty: 5,
          unit: "l",
          reason: "spoilage",
          notes: "Refrigerator temperature spike",
        }),
      }),
    );
    expect(wasteRes.status).toBe(201);
    const log = (await wasteRes.json()).log;
    expect(log.qty).toBe(5);
    expect(log.cost_loss).toBe(260); // 5 * ₹52 = ₹260

    // Stock should be 50 - 5 = 45
    const [wastedMat] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, mat.id));
    expect(Number(wastedMat.stockQty)).toBe(45);

    // 2. Verify stock ledger shows purchase and waste entries
    const ledgerRes = await getLedger(req(`/api/inventory/ledger?outlet_id=${OUTLET}`));
    expect(ledgerRes.status).toBe(200);
    const entries = (await ledgerRes.json()).entries;
    expect(
      entries.some(
        (e: { type: string; qty_delta: number }) => e.type === "waste" && e.qty_delta === -5,
      ),
    ).toBe(true);
    expect(
      entries.some(
        (e: { type: string; qty_delta: number }) => e.type === "purchase" && e.qty_delta === 50,
      ),
    ).toBe(true);
  });
});

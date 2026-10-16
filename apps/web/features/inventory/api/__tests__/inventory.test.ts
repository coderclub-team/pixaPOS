/**
 * Inventory tests: raw-material guards, recipe cost math, and the
 * cancelled-order wastage path (workflows.md §9, ADR-0002).
 *
 * The SQLite mirror is stubbed; module state resets per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

type InventoryApi = typeof import("@/features/inventory/api/service");

let inventory: InventoryApi;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  inventory = await import("@/features/inventory/api/service");
});

describe("raw materials", () => {
  it("creates a material with stock and average cost", async () => {
    const m = await inventory.createRawMaterial({
      name: "Basmati Rice",
      sku: "RICE-001",
      unit: "kg",
      stock_qty: 50,
      cost_price: 120,
    });
    expect(m.stock_qty).toBe(50);
    expect(m.avg_cost).toBe(120);
  });

  it("rejects duplicate SKUs and bad HSN codes", async () => {
    await inventory.createRawMaterial({ name: "Rice", sku: "RICE-001" });
    await expect(inventory.createRawMaterial({ name: "Rice 2", sku: "rice-001" })).rejects.toThrow(
      'SKU "rice-001" already exists',
    );
    await expect(
      inventory.createRawMaterial({ name: "Ghee", sku: "GHEE-001", hsn_code: "12" }),
    ).rejects.toThrow("Invalid HSN 4-8 digits");
  });
});

describe("recipes", () => {
  it("derives cost per serve from ingredient quantities", async () => {
    const rice = await inventory.createRawMaterial({
      name: "Rice",
      sku: "RICE-002",
      unit: "kg",
      stock_qty: 100,
      cost_price: 100,
    });
    const recipe = await inventory.createRecipe({
      name: "Steamed Rice",
      ingredients: [{ material_id: rice.id, qty: 0.2, unit: "kg" }],
    } as never);
    expect(recipe.cost_per_serve).toBeCloseTo(20, 5);
  });
});

describe("wastage", () => {
  it("logs manual waste: deducts stock and books cost_loss = avg_cost × qty", async () => {
    const milk = await inventory.createRawMaterial({
      name: "Milk",
      sku: "MILK-001",
      unit: "ltr",
      stock_qty: 10,
      cost_price: 60,
    });
    const log = await inventory.createWasteLog({
      material_id: milk.id,
      qty: 2,
      reason: "spoilage",
      created_by: "staff_1",
    });
    expect(log.cost_loss).toBe(120);
    expect((await inventory.getRawMaterialById(milk.id))?.stock_qty).toBe(8);
    const ledger = await inventory.getStockLedger({ material_id: milk.id } as never);
    expect(ledger.some((e) => e.type === "waste" && e.qty_delta === -2)).toBe(true);
  });

  it("explodes kitchen-consumed lines into ingredient waste on cancel", async () => {
    const rice = await inventory.createRawMaterial({
      name: "Rice",
      sku: "RICE-003",
      unit: "kg",
      stock_qty: 100,
      cost_price: 100,
    });
    const recipe = await inventory.createRecipe({
      name: "Fried Rice",
      ingredients: [{ material_id: rice.id, qty: 0.25, unit: "kg" }],
    } as never);
    const result = await inventory.recordWasteForCancelledOrder({
      order_id: "ord_cancel_1",
      created_by: "mgr_1",
      lines: [{ recipe_id: recipe.id, servings: 4 }],
    });
    expect(result.logs.length).toBeGreaterThan(0);
    // 0.25 kg × 4 servings = 1 kg wasted
    expect((await inventory.getRawMaterialById(rice.id))?.stock_qty).toBe(99);
    const logs = await inventory.getWasteLogs();
    expect(logs.some((l) => l.reason === "order_cancelled")).toBe(true);
  });
});

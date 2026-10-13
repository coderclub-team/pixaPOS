/**
 * Purchase-order flow tests: draft → sent → billed (received), supplier
 * payments, and purchase returns with returnable-qty guards.
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
let supplierId: string;
let materialId: string;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  inventory = await import("@/features/inventory/api/service");
  const supplier = await inventory.createSupplier({
    name: "Fresh Farms",
    phone: "9811111111",
  });
  supplierId = supplier.id;
  const material = await inventory.createRawMaterial({
    name: "Tomato",
    sku: "TOM-001",
    unit: "kg",
    stock_qty: 0,
    cost_price: 30,
  });
  materialId = material.id;
});

describe("purchase-order lifecycle", () => {
  it("drafts a PO, sends it, and bills it into stock exactly once", async () => {
    const po = await inventory.createPurchaseOrder({
      supplier_id: supplierId,
      items: [{ material_id: materialId, qty: 20, unit_cost: 30 }],
    });
    expect(po.status).toBe("draft");

    await expect(
      inventory.createPurchase({
        supplier_id: supplierId,
        bill_date: new Date().toISOString(),
        items: [{ material_id: materialId, qty: 20, unit_cost: 30 }],
        po_id: po.id,
      } as never),
    ).rejects.toThrow("Only sent POs can be billed");

    await inventory.updatePurchaseOrderStatus(po.id, "sent");
    const purchase = await inventory.createPurchase({
      supplier_id: supplierId,
      bill_date: new Date().toISOString(),
      items: [{ material_id: materialId, qty: 20, unit_cost: 30 }],
      po_id: po.id,
    } as never);
    expect((await inventory.getRawMaterialById(materialId))?.stock_qty).toBe(20);
    expect((await inventory.getPurchaseOrderById(po.id))?.status).toBe("received");

    await expect(
      inventory.createPurchase({
        supplier_id: supplierId,
        bill_date: new Date().toISOString(),
        items: [{ material_id: materialId, qty: 1, unit_cost: 30 }],
        po_id: po.id,
      } as never),
    ).rejects.toThrow("Only sent POs can be billed");
  });

  it("tracks partial and full supplier payments", async () => {
    const po = await inventory.createPurchaseOrder({
      supplier_id: supplierId,
      items: [{ material_id: materialId, qty: 10, unit_cost: 30 }],
    });
    await inventory.updatePurchaseOrderStatus(po.id, "sent");
    const purchase = await inventory.createPurchase({
      supplier_id: supplierId,
      bill_date: new Date().toISOString(),
      items: [{ material_id: materialId, qty: 10, unit_cost: 30 }],
      po_id: po.id,
    } as never);
    const total = purchase.total_amount;
    await expect(inventory.recordPurchasePayment(purchase.id, total + 1)).rejects.toThrow(
      "Paid exceeds total",
    );
    const partial = await inventory.recordPurchasePayment(purchase.id, 100);
    expect(partial.payment_status).toBe("partial");
    const full = await inventory.recordPurchasePayment(purchase.id, total - 100);
    expect(full.payment_status).toBe("paid");
  });
});

describe("purchase returns", () => {
  it("returns stock against a purchase and enforces returnable qty", async () => {
    const purchase = await inventory.createPurchase({
      supplier_id: supplierId,
      bill_date: new Date().toISOString(),
      items: [{ material_id: materialId, qty: 10, unit_cost: 30 }],
    } as never);
    expect(inventory.getReturnableQty(purchase.id, materialId)).toBe(10);

    await expect(
      inventory.createPurchaseReturn({ purchase_id: purchase.id, items: [], reason: "x" } as never),
    ).rejects.toThrow("Add at least one item to return");
    await expect(
      inventory.createPurchaseReturn({
        purchase_id: purchase.id,
        reason: "spoilt",
        items: [{ material_id: materialId, qty_returned: 11 }],
      } as never),
    ).rejects.toThrow(/returnable 10, tried 11/);

    const ret = await inventory.createPurchaseReturn({
      purchase_id: purchase.id,
      reason: "spoilt",
      items: [{ material_id: materialId, qty_returned: 4 }],
    } as never);
    expect(ret.status).toBe("draft");
    await inventory.approvePurchaseReturn(ret.id);
    expect(inventory.getReturnableQty(purchase.id, materialId)).toBe(6);
    expect((await inventory.getRawMaterialById(materialId))?.stock_qty).toBe(6);
    await expect(inventory.approvePurchaseReturn(ret.id)).rejects.toThrow(
      "Only draft returns can be approved",
    );
  });
});

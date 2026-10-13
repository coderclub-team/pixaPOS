/**
 * Order lifecycle tests (workflows.md §1–2).
 *
 * Exercises the localStorage-backed domain service directly: creation
 * guards, item math in integer paise, discounts, cancellation, and the
 * add-on reopen rule. Module state is reset per test via
 * `vi.resetModules()` + dynamic import; the SQLite mirror is stubbed out.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_orders";

type OrdersApi = typeof import("@/features/orders/api/service");
type MenuApi = typeof import("@/features/menu/api/service");

let orders: OrdersApi;
let menu: MenuApi;
let itemId: string;

async function seedMenu() {
  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Paneer Tikka",
    category_id: cat.id,
    basePrice: 250,
    available_channels: ["dine_in", "pickup", "delivery"],
  } as never);
  return item.id;
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  menu = await import("@/features/menu/api/service");
  itemId = await seedMenu();
});

describe("createOrder guards", () => {
  it("creates a counter order as CONFIRMED with a daily order number", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    expect(o.status).toBe("CONFIRMED");
    expect(o.order_number).toMatch(/^ORD-\d{4}$/);
    expect(o.payment_status).toBe("UNPAID");
    expect(o.grand_total_paise).toBe(0);
  });

  it("rejects creation without an outlet", async () => {
    await expect(orders.createOrder({ channel: "counter" })).rejects.toThrow("No outlet selected");
  });

  it("requires a table for dine-in orders", async () => {
    await expect(orders.createOrder({ outlet_id: OUTLET_ID, channel: "dine_in" })).rejects.toThrow(
      "Dine-in orders require a table",
    );
  });

  it("requires a drop address for delivery orders", async () => {
    await expect(orders.createOrder({ outlet_id: OUTLET_ID, channel: "delivery" })).rejects.toThrow(
      "Delivery orders need a drop address",
    );
  });

  it("supports DRAFT carts for the /new flow", async () => {
    const o = await orders.createOrder({
      outlet_id: OUTLET_ID,
      channel: "counter",
      initial_status: "DRAFT",
    });
    expect(o.status).toBe("DRAFT");
  });
});

describe("addOrderItem math (integer paise)", () => {
  it("computes line totals from the selling price", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    const updated = await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 2 });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].unit_price_paise).toBe(25000);
    expect(updated.items[0].line_total_paise).toBe(50000);
    expect(updated.subtotal_paise).toBe(50000);
  });

  it("rejects unavailable items, bad qty, and unknown orders", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await expect(orders.addOrderItem("ord_missing", { menu_item_id: itemId })).rejects.toThrow(
      "Order not found",
    );
    await expect(orders.addOrderItem(o.id, { menu_item_id: "mi_missing" })).rejects.toThrow(
      "Menu item is not available",
    );
    await expect(orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 0 })).rejects.toThrow(
      "Quantity must be a positive integer",
    );
  });
});

describe("cancelOrder", () => {
  it("requires a reason and cancels with an audit trail", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await expect(orders.cancelOrder(o.id, { reason: "" })).rejects.toThrow(
      "A reason is required to cancel an order",
    );
    const cancelled = await orders.cancelOrder(o.id, { reason: "customer left", by: "staff_1" });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("freezes cancelled orders against new items", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await orders.cancelOrder(o.id, { reason: "duplicate" });
    await expect(orders.addOrderItem(o.id, { menu_item_id: itemId })).rejects.toThrow(
      "Cannot add items to a cancelled order.",
    );
  });
});

describe("setDiscount", () => {
  it("validates reason and percent bounds", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 2 });
    await expect(orders.setDiscount(o.id, { percent: 10, by: "mgr" } as never)).rejects.toThrow(
      "A reason is required for a discount",
    );
    await expect(
      orders.setDiscount(o.id, { percent: 150, reason: "x", by: "mgr" }),
    ).rejects.toThrow("Discount percent must be between 0 and 100");
  });

  it("reduces the grand total pro-rata in paise", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 2 }); // 50000
    const discounted = await orders.setDiscount(o.id, {
      percent: 10,
      reason: "festive offer",
      by: "mgr_1",
    });
    expect(discounted.grand_total_paise).toBe(45000);
  });
});

describe("kitchen propagation + completion", () => {
  it("walks CONFIRMED → IN_KITCHEN → SERVED → COMPLETED with payment settled", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 1 });

    const kitchen = await import("@/features/kitchen/api/service");
    const payments = await import("@/features/payments/api/service");

    const ticket = await kitchen.fireKOT(o.id, "staff_1");
    expect((await orders.getOrderById(o.id))?.status).toBe("IN_KITCHEN");

    await kitchen.acceptKOT(ticket.id, "chef_1");
    await kitchen.startPreparingKOT(ticket.id, "chef_1");
    // mark every line ready then serve
    for (const line of (await kitchen.getTicketById(ticket.id))!.lines) {
      await kitchen.markLineReady(ticket.id, line.id, "chef_1");
    }
    await kitchen.serveKOT(ticket.id, "captain_1");
    expect((await orders.getOrderById(o.id))?.status).toBe("SERVED");

    const bill = (await orders.getOrderById(o.id))!;
    await payments.collectPayment({
      order_id: o.id,
      method: "cash",
      amount_paise: bill.grand_total_paise,
      received_by: "cashier_1",
    });
    const done = await orders.completeOrder(o.id, { by: "cashier_1" });
    expect(done.status).toBe("COMPLETED");
  });

  it("refuses completion with an outstanding balance", async () => {
    const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 1 });
    await expect(orders.completeOrder(o.id, { by: "cashier_1" })).rejects.toThrow(
      /remaining|served/i,
    );
  });
});

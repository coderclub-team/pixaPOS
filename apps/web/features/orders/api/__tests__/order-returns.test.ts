/**
 * Item-wise returns end to end (ADR-0016): SERVED bill → createReturn →
 * automatic largest-first refund to the original payment methods.
 *
 * The SQLite mirror is stubbed; module state resets per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_returns";

type OrdersApi = typeof import("@/features/orders/api/service");
type KitchenApi = typeof import("@/features/kitchen/api/service");
type PaymentsApi = typeof import("@/features/payments/api/service");
type MenuApi = typeof import("@/features/menu/api/service");

let orders: OrdersApi;
let kitchen: KitchenApi;
let payments: PaymentsApi;
let orderId: string;
let lineId: string;

async function serveOrder(): Promise<void> {
  const ticket = await kitchen.fireKOT(orderId, "staff_1");
  await kitchen.acceptKOT(ticket.id, "chef_1");
  await kitchen.startPreparingKOT(ticket.id, "chef_1");
  const lines = (await kitchen.getTicketById(ticket.id))!.lines;
  for (const line of lines) await kitchen.markLineReady(ticket.id, line.id, "chef_1");
  await kitchen.serveKOT(ticket.id, "captain_1");
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  kitchen = await import("@/features/kitchen/api/service");
  payments = await import("@/features/payments/api/service");
  const menu: MenuApi = await import("@/features/menu/api/service");

  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Samosa Plate",
    category_id: cat.id,
    basePrice: 100,
    available_channels: ["dine_in", "pickup", "delivery"],
  } as never);

  const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
  const withItem = await orders.addOrderItem(o.id, { menu_item_id: item.id, qty: 2 }); // 20000
  orderId = o.id;
  lineId = withItem.items[0].id;
  await serveOrder();
  await payments.collectPayment({
    order_id: orderId,
    method: "cash",
    amount_paise: 20000,
    tendered_paise: 20000,
    received_by: "cashier_1",
  });
});

describe("createReturn guards", () => {
  it("requires a reason and a served bill", async () => {
    await expect(
      orders.createReturn(orderId, { lines: [{ order_line_id: lineId, qty: 1 }], reason: "" }),
    ).rejects.toThrow("A reason is required for a return");
    const draft = await orders.createOrder({
      outlet_id: OUTLET_ID,
      channel: "counter",
      initial_status: "DRAFT",
    });
    await expect(
      orders.createReturn(draft.id, { lines: [{ order_line_id: lineId, qty: 1 }], reason: "x" }),
    ).rejects.toThrow(/Returns need a served bill/);
  });

  it("caps the return qty at the live line qty", async () => {
    await expect(
      orders.createReturn(orderId, { lines: [{ order_line_id: lineId, qty: 5 }], reason: "x" }),
    ).rejects.toThrow(/only 2 returnable/);
  });
});

describe("createReturn success path", () => {
  it("voids one serving off the KOT, leaves the bill pro-rata, refunds cash", async () => {
    const { order, ret } = await orders.createReturn(orderId, {
      lines: [{ order_line_id: lineId, qty: 1 }],
      reason: "cold food",
      by: "mgr_1",
    });
    expect(ret.lines[0].qty).toBe(1);
    // Half the servings returned → half the bill stands
    expect(order.grand_total_paise).toBe(10000);

    const refunds = await payments.getRefundsByOrder(orderId);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount_paise).toBe(10000);
    expect(refunds[0].status).toBe("REFUNDED");
    expect(await payments.paidTotalForOrder(orderId)).toBe(10000);
  });

  it("splits the refund largest-payment-first across methods", async () => {
    // Second order paid half-UPI / half-cash so allocation must split
    const menu: MenuApi = await import("@/features/menu/api/service");
    const items = await menu.getMenuItems();
    const o2 = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    const withItem = await orders.addOrderItem(o2.id, { menu_item_id: items[0].id, qty: 2 });
    const ticket = await kitchen.fireKOT(o2.id, "staff_1");
    await kitchen.acceptKOT(ticket.id, "chef_1");
    await kitchen.startPreparingKOT(ticket.id, "chef_1");
    for (const l of (await kitchen.getTicketById(ticket.id))!.lines) {
      await kitchen.markLineReady(ticket.id, l.id, "chef_1");
    }
    await kitchen.serveKOT(ticket.id, "captain_1");
    await payments.collectPayment({
      order_id: o2.id,
      method: "upi",
      amount_paise: 15000,
      received_by: "cashier_1",
    });
    await payments.collectPayment({
      order_id: o2.id,
      method: "cash",
      amount_paise: 5000,
      tendered_paise: 5000,
      received_by: "cashier_1",
    });

    const preview = await payments.previewReturnAllocation(o2.id, 10000);
    expect(preview.shortfall_paise).toBe(0);
    // Largest payment (UPI 15000) absorbs the whole 10000 return
    expect(preview.allocations[0].payment_id).toBeDefined();
    expect(preview.allocations.reduce((s, a) => s + a.amount_paise, 0)).toBe(10000);

    await orders.createReturn(o2.id, {
      lines: [{ order_line_id: withItem.items[0].id, qty: 1 }],
      reason: "wrong item",
    });
    const refunds = await payments.getRefundsByOrder(o2.id);
    expect(refunds.reduce((s, r) => s + r.amount_paise, 0)).toBe(10000);
  });
});

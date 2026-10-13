/**
 * Payment workflow tests (workflows.md §4).
 *
 * Split payments, cash tendering, balance guards, and refunds — all in
 * integer paise. The SQLite mirror is stubbed; module state resets per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_payments";

type OrdersApi = typeof import("@/features/orders/api/service");
type PaymentsApi = typeof import("@/features/payments/api/service");
type MenuApi = typeof import("@/features/menu/api/service");

let orders: OrdersApi;
let payments: PaymentsApi;
let billTotal: number;
let orderId: string;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  payments = await import("@/features/payments/api/service");
  const menu: MenuApi = await import("@/features/menu/api/service");

  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Butter Naan",
    category_id: cat.id,
    basePrice: 40,
    available_channels: ["dine_in", "pickup", "delivery"],
  } as never);

  const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
  await orders.addOrderItem(o.id, { menu_item_id: item.id, qty: 3 }); // 12000 paise
  orderId = o.id;
  billTotal = (await orders.getOrderById(o.id))!.grand_total_paise;
  expect(billTotal).toBe(12000);
});

describe("collectPayment", () => {
  it("settles the bill and marks the order PAID", async () => {
    const p = await payments.collectPayment({
      order_id: orderId,
      method: "cash",
      amount_paise: billTotal,
      tendered_paise: billTotal,
      received_by: "cashier_1",
    });
    expect(p.status).toBe("PAID");
    expect(await payments.paidTotalForOrder(orderId)).toBe(billTotal);
    const bill = await orders.getOrderWithBilling(orderId);
    expect(bill?.balance_paise).toBe(0);
    expect(bill?.paid_paise).toBe(billTotal);
    expect(bill?.order.payment_status).toBe("PAID");
  });

  it("supports split payments across methods", async () => {
    await payments.collectPayment({
      order_id: orderId,
      method: "upi",
      amount_paise: 5000,
      received_by: "cashier_1",
    });
    await payments.collectPayment({
      order_id: orderId,
      method: "cash",
      amount_paise: 7000,
      tendered_paise: 7000,
      received_by: "cashier_1",
    });
    expect(await payments.paidTotalForOrder(orderId)).toBe(billTotal);
    const bill = await orders.getOrderWithBilling(orderId);
    expect(bill?.balance_paise).toBe(0);
    expect(bill?.order.payment_status).toBe("PAID");
  });

  it("rejects non-positive amounts and overpayment", async () => {
    await expect(
      payments.collectPayment({ order_id: orderId, method: "cash", amount_paise: 0 }),
    ).rejects.toThrow("Amount must be a positive paise integer");
    await expect(
      payments.collectPayment({ order_id: orderId, method: "cash", amount_paise: billTotal + 1 }),
    ).rejects.toThrow(/exceeds the balance/);
  });

  it("requires cash tender to cover the amount", async () => {
    await expect(
      payments.collectPayment({
        order_id: orderId,
        method: "cash",
        amount_paise: 5000,
        tendered_paise: 4000,
      }),
    ).rejects.toThrow("Tendered cash must cover the amount");
    await expect(
      payments.collectPayment({
        order_id: orderId,
        method: "upi",
        amount_paise: 5000,
        tendered_paise: 5000,
      }),
    ).rejects.toThrow("Tendered/change applies to cash only");
  });

  it("rejects payments for unknown orders", async () => {
    await expect(
      payments.collectPayment({ order_id: "ord_missing", method: "cash", amount_paise: 100 }),
    ).rejects.toThrow("Order not found");
  });
});

describe("recordRefund", () => {
  it("refunds part of a paid payment with a reason", async () => {
    const p = await payments.collectPayment({
      order_id: orderId,
      method: "cash",
      amount_paise: billTotal,
      tendered_paise: billTotal,
      received_by: "cashier_1",
    });
    const r = await payments.recordRefund({
      payment_id: p.id,
      amount_paise: 2000,
      reason: "item returned",
      by: "mgr_1",
    });
    expect(r.amount_paise).toBe(2000);
    expect(await payments.paidTotalForOrder(orderId)).toBe(billTotal - 2000);
  });

  it("requires a reason and caps the refund at the payment amount", async () => {
    const p = await payments.collectPayment({
      order_id: orderId,
      method: "upi",
      amount_paise: billTotal,
      received_by: "cashier_1",
    });
    await expect(
      payments.recordRefund({ payment_id: p.id, amount_paise: 100, reason: "" }),
    ).rejects.toThrow("A reason is required for a refund");
    await expect(
      payments.recordRefund({ payment_id: p.id, amount_paise: billTotal + 1, reason: "x" }),
    ).rejects.toThrow("Refund exceeds the payment amount");
  });
});

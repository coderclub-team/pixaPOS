/**
 * Promo + rewards tests (bill discounts beyond manual setDiscount).
 *
 * Percent/flat promo application, promo guards, and the rewards
 * earn → link → redeem → remove loop. The SQLite mirror is stubbed;
 * module state resets per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_promos";

type OrdersApi = typeof import("@/features/orders/api/service");
type PromosApi = typeof import("@/features/promos/api/service");
type RewardsApi = typeof import("@/features/rewards/api/service");
type MenuApi = typeof import("@/features/menu/api/service");
type CustomersApi = typeof import("@/features/customers/api/service");

let orders: OrdersApi;
let promos: PromosApi;
let rewards: RewardsApi;
let orderId: string;
let subtotal: number;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  promos = await import("@/features/promos/api/service");
  rewards = await import("@/features/rewards/api/service");
  const menu: MenuApi = await import("@/features/menu/api/service");

  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Chole Bhature",
    category_id: cat.id,
    basePrice: 200,
    available_channels: ["dine_in", "pickup", "delivery"],
  } as never);

  const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
  await orders.addOrderItem(o.id, { menu_item_id: item.id, qty: 2 }); // 40000
  orderId = o.id;
  subtotal = (await orders.getOrderById(o.id))!.subtotal_paise;
  expect(subtotal).toBe(40000);
});

describe("createPromo guards", () => {
  it("rejects bad codes and duplicate codes per outlet", async () => {
    await expect(
      promos.createPromo({ code: "x", kind: "percent", value: 10, scope: "order" } as never),
    ).rejects.toThrow("Code: 3–20 chars");
    await promos.createPromo(
      { code: "DIWALI10", kind: "percent", value: 10, scope: "order" } as never,
      OUTLET_ID,
    );
    await expect(
      promos.createPromo(
        { code: "diwali10", kind: "percent", value: 10, scope: "order" } as never,
        OUTLET_ID,
      ),
    ).rejects.toThrow("already exists in this outlet");
  });
});

describe("applyPromo", () => {
  it("applies a 10% order promo in paise", async () => {
    await promos.createPromo(
      { code: "SAVE10", kind: "percent", value: 10, scope: "order" } as never,
      OUTLET_ID,
    );
    const updated = await orders.applyPromo(orderId, "save10", { by: "cashier_1" });
    expect(updated.grand_total_paise).toBe(36000);
    expect(updated.discount_reason).toBe("PROMO:SAVE10");
  });

  it("rejects unknown, inactive, and expired promos", async () => {
    await expect(orders.applyPromo(orderId, "NOPE")).rejects.toThrow("Promo NOPE not found");
    await promos.createPromo(
      { code: "OFF9", kind: "percent", value: 9, scope: "order", is_active: false } as never,
      OUTLET_ID,
    );
    await expect(orders.applyPromo(orderId, "OFF9")).rejects.toThrow("is inactive");
    await promos.createPromo(
      {
        code: "OLD5",
        kind: "percent",
        value: 5,
        scope: "order",
        ends_at: "2020-01-01T00:00:00.000Z",
      } as never,
      OUTLET_ID,
    );
    await expect(orders.applyPromo(orderId, "OLD5")).rejects.toThrow(/expired/);
  });

  it("enforces the minimum bill", async () => {
    await promos.createPromo(
      {
        code: "BIG50",
        kind: "flat",
        value: 5000,
        scope: "order",
        min_order_paise: 100000,
      } as never,
      OUTLET_ID,
    );
    await expect(orders.applyPromo(orderId, "BIG50")).rejects.toThrow(/minimum bill/);
  });

  it("removes the promo and restores the total", async () => {
    await promos.createPromo(
      { code: "SAVE10", kind: "percent", value: 10, scope: "order" } as never,
      OUTLET_ID,
    );
    await orders.applyPromo(orderId, "SAVE10");
    const cleared = await orders.removePromo(orderId, { by: "mgr_1" });
    expect(cleared.grand_total_paise).toBe(40000);
    await expect(orders.removePromo(orderId)).rejects.toThrow("No promo applied on this order");
  });
});

describe("rewards earn → redeem", () => {
  it("earns points per ₹10 and redeems them against a linked customer bill", async () => {
    const customers: CustomersApi = await import("@/features/customers/api/service");
    const customer = await customers.createCustomer({
      outlet_id: OUTLET_ID,
      name: "Regular Ravi",
      phone: "9876543210",
    });
    await orders.linkCustomer(orderId, customer.id);

    const earned = await rewards.earnForOrder(customer.id, orderId, 40000);
    expect(earned).toBe(40); // 1 pt per ₹10
    expect(await rewards.rewardBalance(customer.id)).toBe(40);

    const redeemed = await orders.redeemRewards(orderId, 20, { by: "cashier_1" });
    expect(redeemed.grand_total_paise).toBe(40000 - 2000); // 1 pt = ₹1
    expect(redeemed.discount_reason).toBe("REWARDS:20pts");
    expect(await rewards.rewardBalance(customer.id)).toBe(20);

    const cleared = await orders.removeRewardsRedeem(orderId, { by: "mgr_1" });
    expect(cleared.grand_total_paise).toBe(40000);
    expect(await rewards.rewardBalance(customer.id)).toBe(40);
  });

  it("requires a linked customer and sufficient points", async () => {
    await expect(orders.redeemRewards(orderId, 5)).rejects.toThrow(
      "Link a customer to redeem rewards",
    );
    const customers: CustomersApi = await import("@/features/customers/api/service");
    const customer = await customers.createCustomer({
      outlet_id: OUTLET_ID,
      name: "New Nina",
      phone: "9876543211",
    });
    await orders.linkCustomer(orderId, customer.id);
    await expect(orders.redeemRewards(orderId, 500)).rejects.toThrow("Insufficient reward points");
  });
});

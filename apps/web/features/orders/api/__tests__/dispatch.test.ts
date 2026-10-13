/**
 * Dispatch-channel branch (workflows.md §1): delivery orders cap at READY,
 * then move explicitly OUT_FOR_DELIVERY → DELIVERED → COMPLETED.
 *
 * Own-fleet (channel "delivery") and aggregator (channel "zomato") paths
 * are both covered. The SQLite mirror is stubbed; module state resets
 * per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_dispatch";

type OrdersApi = typeof import("@/features/orders/api/service");
type KitchenApi = typeof import("@/features/kitchen/api/service");
type PaymentsApi = typeof import("@/features/payments/api/service");
type MenuApi = typeof import("@/features/menu/api/service");

let orders: OrdersApi;
let kitchen: KitchenApi;
let payments: PaymentsApi;
let itemId: string;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  kitchen = await import("@/features/kitchen/api/service");
  payments = await import("@/features/payments/api/service");
  const menu: MenuApi = await import("@/features/menu/api/service");

  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Biryani",
    category_id: cat.id,
    basePrice: 300,
    available_channels: ["dine_in", "pickup", "delivery", "zomato", "swiggy"],
  } as never);
  itemId = item.id;
});

async function readyDeliveryOrder(channel: "delivery" | "zomato" = "delivery") {
  const base = { outlet_id: OUTLET_ID, channel, staff_initiated: true } as const;
  const o =
    channel === "delivery"
      ? await orders.createOrder({ ...base, delivery_address: "221B Baker Street" })
      : await orders.createOrder({ ...base, external_ref: "ZOM-123" });
  await orders.addOrderItem(o.id, { menu_item_id: itemId, qty: 1 });
  const ticket = await kitchen.fireKOT(o.id, "staff_1");
  await kitchen.acceptKOT(ticket.id, "chef_1");
  await kitchen.startPreparingKOT(ticket.id, "chef_1");
  for (const line of (await kitchen.getTicketById(ticket.id))!.lines) {
    await kitchen.markLineReady(ticket.id, line.id, "chef_1");
  }
  return o.id;
}

describe("delivery order creation", () => {
  it("carries its address snapshot; aggregators use external refs", async () => {
    const own = await orders.createOrder({
      outlet_id: OUTLET_ID,
      channel: "delivery",
      delivery_address: "221B Baker Street",
      staff_initiated: true,
    });
    expect(own.delivery_address_snapshot).toBe("221B Baker Street");
    const agg = await orders.createOrder({
      outlet_id: OUTLET_ID,
      channel: "zomato",
      external_ref: "ZOM-123",
      staff_initiated: true,
    });
    expect(agg.external_ref).toBe("ZOM-123");
  });
});

describe("dispatch flow", () => {
  it("caps at READY, then dispatches with a rider and auto-serves KOTs", async () => {
    const id = await readyDeliveryOrder();
    // Served lines must NOT auto-advance a delivery order past READY
    expect((await orders.getOrderById(id))?.status).toBe("READY");

    await expect(orders.dispatchOrder(id)).rejects.toThrow("Assign a rider before dispatch");
    await expect(orders.assignRider(id, { rider_name: "" })).rejects.toThrow(
      "Rider name is required",
    );
    await orders.assignRider(id, { rider_name: "Ravi", by: "dispatcher_1" });
    const dispatched = await orders.dispatchOrder(id, { by: "dispatcher_1" });
    expect(dispatched.status).toBe("OUT_FOR_DELIVERY");

    // KDS cleared at handoff: open tickets auto-served
    const tickets = await kitchen.getKOTsByOrder(id);
    expect(tickets.every((t) => t.status === "SERVED")).toBe(true);

    const delivered = await orders.markDelivered(id, { by: "dispatcher_1" });
    expect(delivered.status).toBe("DELIVERED");

    const bill = (await orders.getOrderById(id))!;
    await payments.collectPayment({
      order_id: id,
      method: "upi",
      amount_paise: bill.grand_total_paise,
      received_by: "cashier_1",
    });
    const done = await orders.completeOrder(id, { by: "cashier_1" });
    expect(done.status).toBe("COMPLETED");
  });

  it("guards dispatch and delivery transitions", async () => {
    const id = await readyDeliveryOrder("zomato");
    await expect(orders.markDelivered(id)).rejects.toThrow(
      "Only out-for-delivery orders can be marked delivered",
    );
    const counter = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
    await expect(orders.assignRider(counter.id, { rider_name: "Ravi" })).rejects.toThrow(
      "Only delivery-channel orders take a rider",
    );
    await expect(orders.dispatchOrder(counter.id)).rejects.toThrow(
      "Only delivery-channel orders can be dispatched",
    );
  });
});

/**
 * Kitchen/KOT workflow tests (workflows.md §3 + ADR-0005 linkage).
 *
 * Strict step-by-step ticket and line machines, void guards, and the
 * order ↔ KOT linkage. The SQLite mirror is stubbed; module state resets
 * per test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_kitchen";

type OrdersApi = typeof import("@/features/orders/api/service");
type KitchenApi = typeof import("@/features/kitchen/api/service");
type MenuApi = typeof import("@/features/menu/api/service");

let orders: OrdersApi;
let kitchen: KitchenApi;
let orderId: string;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  orders = await import("@/features/orders/api/service");
  kitchen = await import("@/features/kitchen/api/service");
  const menu: MenuApi = await import("@/features/menu/api/service");

  const cat = await menu.createMenuCategory({ name: "Mains" } as never);
  const item = await menu.createMenuItem({
    name: "Dal Fry",
    category_id: cat.id,
    basePrice: 180,
    available_channels: ["dine_in", "pickup", "delivery"],
  } as never);

  const o = await orders.createOrder({ outlet_id: OUTLET_ID, channel: "counter" });
  await orders.addOrderItem(o.id, { menu_item_id: item.id, qty: 2 });
  orderId = o.id;
});

async function readyTicket(ticketId: string, by = "chef_1") {
  await kitchen.acceptKOT(ticketId, by);
  await kitchen.startPreparingKOT(ticketId, by);
  const ticket = (await kitchen.getTicketById(ticketId))!;
  for (const line of ticket.lines) {
    await kitchen.markLineReady(ticketId, line.id, by);
  }
}

describe("fireKOT", () => {
  it("creates a NEW ticket and moves the order IN_KITCHEN", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    expect(ticket.status).toBe("NEW");
    expect(ticket.order_id).toBe(orderId);
    expect((await orders.getOrderById(orderId))?.status).toBe("IN_KITCHEN");
  });

  it("refuses to fire when nothing new was added", async () => {
    await kitchen.fireKOT(orderId, "staff_1");
    await expect(kitchen.fireKOT(orderId, "staff_1")).rejects.toThrow("No new items to fire");
  });
});

describe("strict step-by-step transitions", () => {
  it("cannot prepare before accepting", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    await expect(kitchen.startPreparingKOT(ticket.id, "chef_1")).rejects.toThrow(
      "Accept the KOT before preparing",
    );
  });

  it("cannot mark a line ready before it starts preparing", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    await kitchen.acceptKOT(ticket.id, "chef_1");
    const line = (await kitchen.getTicketById(ticket.id))!.lines[0];
    await expect(kitchen.markLineReady(ticket.id, line.id, "chef_1")).rejects.toThrow(
      /before marking it ready|cannot be marked ready/i,
    );
  });

  it("walks lines to READY and serves only a fully-ready ticket", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    await kitchen.acceptKOT(ticket.id, "chef_1");
    await kitchen.startPreparingKOT(ticket.id, "chef_1");
    const afterStart = (await kitchen.getTicketById(ticket.id))!;
    expect(afterStart.status).toBe("PREPARING");
    await expect(kitchen.serveKOT(ticket.id, "captain_1")).rejects.toThrow(
      "Only READY tickets can be served",
    );
    for (const line of afterStart.lines) {
      await kitchen.markLineReady(ticket.id, line.id, "chef_1");
    }
    expect((await kitchen.getTicketById(ticket.id))!.status).toBe("READY");
    await kitchen.serveKOT(ticket.id, "captain_1");
    expect((await kitchen.getTicketById(ticket.id))!.status).toBe("SERVED");
    expect((await orders.getOrderById(orderId))?.status).toBe("SERVED");
  });
});

describe("voids", () => {
  it("requires a reason to void a ticket", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    await expect(kitchen.voidKOT(ticket.id, { reason: "" })).rejects.toThrow(
      "A reason is required to void a KOT",
    );
    const voided = await kitchen.voidKOT(ticket.id, { reason: "wrong item", by: "mgr_1" });
    expect(voided.status).toBe("CANCELLED");
  });

  it("never voids a served ticket or served line", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    await readyTicket(ticket.id);
    await kitchen.serveKOT(ticket.id, "captain_1");
    await expect(kitchen.voidKOT(ticket.id, { reason: "x" })).rejects.toThrow(
      "A served KOT cannot be voided",
    );
    const line = (await kitchen.getTicketById(ticket.id))!.lines[0];
    await expect(kitchen.voidKOTLine(ticket.id, line.id, { reason: "x" })).rejects.toThrow(
      /served/i,
    );
  });

  it("bounds the voided qty to the live line qty", async () => {
    const ticket = await kitchen.fireKOT(orderId, "staff_1");
    const line = (await kitchen.getTicketById(ticket.id))!.lines[0];
    await expect(kitchen.voidKOTLine(ticket.id, line.id, { qty: 99, reason: "x" })).rejects.toThrow(
      "Void qty must be between 1 and",
    );
  });
});

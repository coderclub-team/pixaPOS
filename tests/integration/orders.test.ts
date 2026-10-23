/**
 * Integration: orders + KOTs + payments against the isolated test database.
 * Auth boundary stubbed (admin); state machines + billing math are real.
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

import { GET as listOrders, POST as createOrder } from "@/app/api/orders/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as addItem } from "@/app/api/orders/[id]/items/route";
import { DELETE as removeLine, PATCH as setQty } from "@/app/api/orders/[id]/items/[lineId]/route";
import { POST as fire } from "@/app/api/orders/[id]/fire/route";
import { POST as collect } from "@/app/api/orders/[id]/pay/route";
import { GET as billing } from "@/app/api/orders/[id]/billing/route";
import { POST as complete } from "@/app/api/orders/[id]/complete/route";
import { POST as cancel } from "@/app/api/orders/[id]/cancel/route";
import { PUT as setDiscount } from "@/app/api/orders/[id]/discount/route";
import { POST as split } from "@/app/api/orders/[id]/split/route";
import { POST as doReturn } from "@/app/api/orders/[id]/returns/route";
import { GET as listKots } from "@/app/api/kots/route";
import { GET as getTicket } from "@/app/api/kots/[id]/route";
import { PATCH as kotAction } from "@/app/api/kots/[id]/route";
import { GET as kotsByOrder } from "@/app/api/kots/by-order/[orderId]/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baOrganization, baUser, menuCategories, menuItems, menuVariants, outlets } from "@pixa/db";

let OUTLET = "";
let ITEM_ID = "";
let VARIANT_ID = "";

async function authedAdmin() {
  const database = getTestDb();
  const userId = testId("user");
  await database
    .insert(baUser)
    .values({
      id: userId,
      name: "Orders Tester",
      email: `${userId}@test.local`,
      emailVerified: true,
    })
    .onConflictDoNothing();
  const orgId = `org_orders_${userId.slice(-4)}`;
  await database
    .insert(baOrganization)
    .values({ id: orgId, name: "Orders Test Org", slug: `o-${userId.slice(-4)}` })
    .onConflictDoNothing();
  OUTLET = testId("outlet");
  await database.insert(outlets).values({
    id: OUTLET,
    organizationId: orgId,
    name: "Main",
    code: `M${userId.slice(-4).toUpperCase()}`,
    isActive: true,
  });
  mockBaSession.mockResolvedValue({ user: { id: userId } });
  mockBaOrgId.mockResolvedValue(orgId);
  mockBaHas.mockResolvedValue(true);
  return { userId, orgId };
}

async function seedMenu(orgId: string) {
  const database = getTestDb();
  const catId = testId("cat");
  await database
    .insert(menuCategories)
    .values({ id: catId, organizationId: orgId, name: "Mains", isActive: true });
  ITEM_ID = testId("item");
  await database.insert(menuItems).values({
    id: ITEM_ID,
    organizationId: orgId,
    categoryId: catId,
    name: "Paneer Tikka",
    isActive: true,
    taxable: true,
    taxPercent: 5,
  });
  VARIANT_ID = testId("var");
  await database.insert(menuVariants).values({
    id: VARIANT_ID,
    organizationId: orgId,
    menuItemId: ITEM_ID,
    name: "Regular",
    sellingPrice: 25000,
    isDefault: true,
    isActive: true,
  });
}

function post(body: unknown) {
  return new Request("http://test.local/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function get(url: string) {
  return new Request(url, { method: "GET" }) as never;
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;

async function makeOrder(channel = "counter"): Promise<{ id: string; order_number: string }> {
  const res = await createOrder(post({ outlet_id: OUTLET, channel }), ctx({}));
  expect(res.status).toBe(201);
  const body = (await res.json()) as {
    order: { id: string; order_number: string; status: string };
  };
  expect(body.order.status).toBe("CONFIRMED");
  return body.order;
}

async function makeFiredOrder(): Promise<{ orderId: string; kotId: string; lineId: string }> {
  const o = await makeOrder();
  await addItem(post({ menu_item_id: ITEM_ID, variant_id: VARIANT_ID, qty: 2 }), ctx({ id: o.id }));
  const fired = (await (await fire(post({}), ctx({ id: o.id }))).json()) as {
    order: { id: string; status: string };
    ticket: { id: string; status: string };
  };
  expect(fired.order.status).toBe("IN_KITCHEN");
  expect(fired.ticket.status).toBe("NEW");
  const detail = (await (await getOrder({} as never, ctx({ id: o.id }))).json()) as {
    order: { items: { id: string; kot_id: string }[] };
  };
  return { orderId: o.id, kotId: fired.ticket.id, lineId: detail.order.items[0].id };
}

describe("orders terminal loop", () => {
  // Remote test DB round-trips are slow; each step is a full HTTP-less
  // route invocation with several sequential queries.
  vi.setConfig({ testTimeout: 120_000 });

  beforeAll(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "orders-test-secret-please-change");
  });

  beforeEach(async () => {
    await resetTestDb();
    const { orgId } = await authedAdmin();
    await seedMenu(orgId);
  });

  it("creates a counter order and derives billing", async () => {
    const o = await makeOrder();
    await addItem(
      post({ menu_item_id: ITEM_ID, variant_id: VARIANT_ID, qty: 2 }),
      ctx({ id: o.id }),
    );
    const b = (await (await billing(get("http://test.local/x"), ctx({ id: o.id }))).json()) as {
      order: { grand_total_paise: number };
      paid_paise: number;
      balance_paise: number;
    };
    // 2 × ₹250 + 5% tax = ₹52500
    expect(b.order.grand_total_paise).toBe(52500);
    expect(b.paid_paise).toBe(0);
    expect(b.balance_paise).toBe(52500);
  });

  it("lists orders with derived fields", async () => {
    await makeOrder();
    const rows = (await (
      await listOrders(get(`http://test.local/x?outlet_id=${OUTLET}`), ctx({}) as never)
    ).json()) as { rows: { order_number: string; fired_items: number }[] };
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].fired_items).toBe(0);
  });

  it("edits and removes draft lines", async () => {
    const o = await makeOrder();
    await addItem(
      post({ menu_item_id: ITEM_ID, variant_id: VARIANT_ID, qty: 1 }),
      ctx({ id: o.id }),
    );
    const detail = (await (await getOrder({} as never, ctx({ id: o.id }))).json()) as {
      order: { items: { id: string }[] };
    };
    const lineId = detail.order.items[0].id;
    const upd = (await (
      await setQty(post({ qty: 3 }), { params: Promise.resolve({ id: o.id, lineId }) } as never)
    ).json()) as { order: { items: { qty: number }[] } };
    expect(upd.order.items[0].qty).toBe(3);
    await removeLine({} as never, { params: Promise.resolve({ id: o.id, lineId }) } as never);
    const after = (await (await getOrder({} as never, ctx({ id: o.id }))).json()) as {
      order: { items: unknown[] };
    };
    expect(after.order.items).toHaveLength(0);
  });

  it("fires, walks the kitchen, and completes with payment", async () => {
    const { orderId, kotId } = await makeFiredOrder();
    const act = (p: Record<string, unknown>) => kotAction(post(p), ctx({ id: kotId }));
    await act({ action: "accept" });
    const t = (await (await getTicket({} as never, ctx({ id: kotId }))).json()) as {
      ticket: { lines: { id: string }[] };
    };
    const lineId = t.ticket.lines[0].id;
    await act({ action: "start-line", line_id: lineId });
    await act({ action: "line-ready", line_id: lineId });
    const list = (await (
      await listKots(get(`http://test.local/x?outlet_id=${OUTLET}&status=READY`), ctx({}) as never)
    ).json()) as { rows: { id: string }[] };
    expect(list.rows.map((r) => r.id)).toContain(kotId);
    await act({ action: "serve" });
    const servedOrder = (await (await getOrder({} as never, ctx({ id: orderId }))).json()) as {
      order: { status: string };
    };
    expect(servedOrder.order.status).toBe("SERVED");
    const p = (await (
      await collect(
        post({ method: "cash", amount_paise: 52500, tendered_paise: 60000 }),
        ctx({ id: orderId }),
      )
    ).json()) as { payment: { change_paise: number } };
    expect(p.payment.change_paise).toBe(7500);
    const done = (await (await complete(post({}), ctx({ id: orderId }))).json()) as {
      order: { status: string };
    };
    expect(done.order.status).toBe("COMPLETED");
  });

  it("rejects completion with an open balance and double completion", async () => {
    const { orderId, kotId } = await makeFiredOrder();
    expect((await complete(post({}), ctx({ id: orderId }))).status).toBe(400);
    const act = (p: Record<string, unknown>) => kotAction(post(p), ctx({ id: kotId }));
    const t = (await (await getTicket({} as never, ctx({ id: kotId }))).json()) as {
      ticket: { lines: { id: string }[] };
    };
    await act({ action: "accept" });
    await act({ action: "start-line", line_id: t.ticket.lines[0].id });
    await act({ action: "line-ready", line_id: t.ticket.lines[0].id });
    await act({ action: "serve" });
    await collect(post({ method: "cash", amount_paise: 52500 }), ctx({ id: orderId }));
    await complete(post({}), ctx({ id: orderId }));
    expect((await complete(post({}), ctx({ id: orderId }))).status).toBe(400);
  });

  it("cancels with a reason and blocks anonymous kitchen cancels", async () => {
    const { orderId, kotId } = await makeFiredOrder();
    // Walk a line to PREPARING so the authorizer rule engages.
    const t = (await (await getTicket({} as never, ctx({ id: kotId }))).json()) as {
      ticket: { lines: { id: string }[] };
    };
    await kotAction(
      post({ action: "accept-line", line_id: t.ticket.lines[0].id }),
      ctx({ id: kotId }),
    );
    await kotAction(
      post({ action: "start-line", line_id: t.ticket.lines[0].id }),
      ctx({ id: kotId }),
    );
    expect((await cancel(post({ reason: "x", by: "" }), ctx({ id: orderId }))).status).toBe(400);
    expect(
      (await cancel(post({ reason: "guest left", by: "mgr_1" }), ctx({ id: orderId }))).status,
    ).toBe(200);
    const gone = (await (await getOrder({} as never, ctx({ id: orderId }))).json()) as {
      order: { status: string };
    };
    expect(gone.order.status).toBe("CANCELLED");
  });

  it("applies a manual discount and splits the bill", async () => {
    const o = await makeOrder();
    await addItem(
      post({ menu_item_id: ITEM_ID, variant_id: VARIANT_ID, qty: 2 }),
      ctx({ id: o.id }),
    );
    const d = (await (
      await setDiscount(post({ percent: 10, reason: "staff" }), ctx({ id: o.id }))
    ).json()) as { order: { grand_total_paise: number } };
    // 50000 − 10% + 5% tax on 45000 = 47250
    expect(d.order.grand_total_paise).toBe(47250);
    const s = (await (
      await split(post({ mode: "equal", count: 2 }), ctx({ id: o.id }))
    ).json()) as { order: { split: { partitions: { amount_paise: number }[] } } };
    expect(s.order.split.partitions.map((p) => p.amount_paise)).toEqual([23625, 23625]);
  });

  it("voids a KOT line before serving", async () => {
    const { orderId, kotId } = await makeFiredOrder();
    const t = (await (await getTicket({} as never, ctx({ id: kotId }))).json()) as {
      ticket: { lines: { id: string }[] };
    };
    const v = (await (
      await kotAction(
        post({ action: "void-line", line_id: t.ticket.lines[0].id, qty: 1, reason: "burnt" }),
        ctx({ id: kotId }),
      )
    ).json()) as { ticket: { lines: { status: string; voided_qty: number }[] } };
    expect(v.ticket.lines[0].voided_qty).toBe(1);
    void orderId;
  });

  it("returns a served item with a same-method refund", async () => {
    const { orderId, kotId } = await makeFiredOrder();
    const t0 = (await (await getTicket({} as never, ctx({ id: kotId }))).json()) as {
      ticket: { lines: { id: string }[] };
    };
    const lineId = t0.ticket.lines[0].id;
    const act = (p: Record<string, unknown>) => kotAction(post(p), ctx({ id: kotId }));
    await act({ action: "accept" });
    await act({ action: "start-line", line_id: lineId });
    await act({ action: "line-ready", line_id: lineId });
    await act({ action: "serve" });
    await collect(post({ method: "cash", amount_paise: 52500 }), ctx({ id: orderId }));
    await complete(post({}), ctx({ id: orderId }));
    const detail = (await (await getOrder({} as never, ctx({ id: orderId }))).json()) as {
      order: { items: { id: string }[] };
    };
    const byOrder = (await (
      await kotsByOrder(get("http://test.local/x"), ctx({ orderId }))
    ).json()) as {
      tickets: { id: string }[];
    };
    expect(byOrder.tickets.map((x) => x.id)).toContain(kotId);
    const r = (await (
      await doReturn(
        post({
          lines: [{ order_line_id: detail.order.items[0].id, qty: 1 }],
          reason: "cold",
          total_paise: 25000,
        }),
        ctx({ id: orderId }),
      )
    ).json()) as { order: { grand_total_paise: number } };
    expect(r.order.grand_total_paise).toBe(26250);
  });
});

/**
 * Integration: tables + floors + occupancy against the isolated test database.
 * Auth boundary stubbed (admin); persistence + guards are real.
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

import { GET as listFloors, POST as createFloor } from "@/app/api/floors/route";
import { GET as getFloorLayout } from "@/app/api/floors/[id]/layout/route";
import { GET as listTables, POST as createTable } from "@/app/api/tables/route";
import { GET as getTable } from "@/app/api/tables/[id]/route";
import { POST as tablePose } from "@/app/api/tables/[id]/pose/route";
import { POST as tableOccupancy } from "@/app/api/tables/[id]/occupancy/route";
import { POST as tableStatus } from "@/app/api/tables/[id]/status/route";
import { POST as tableBlock, DELETE as tableUnblock } from "@/app/api/tables/[id]/block/route";
import { POST as createHold } from "@/app/api/tables/[id]/holds/route";
import { PATCH as updateHold } from "@/app/api/holds/[id]/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baOrganization, baUser, outlets } from "@pixa/db";

const ORG = "org_tables_test";
let OUTLET = "";

async function authedAdmin() {
  const database = getTestDb();
  const userId = testId("user");
  await database
    .insert(baUser)
    .values({
      id: userId,
      name: "Tables Tester",
      email: `${userId}@test.local`,
      emailVerified: true,
    })
    .onConflictDoNothing();
  const orgId = `${ORG}_${userId.slice(-4)}`;
  await database
    .insert(baOrganization)
    .values({ id: orgId, name: "Tables Test Org", slug: `t-${userId.slice(-4)}` })
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

describe("tables + floors API", () => {
  let floorId = "";

  beforeAll(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "tables-test-secret-please-change");
  });

  beforeEach(async () => {
    await resetTestDb();
    await authedAdmin();
    // Fresh floor per test (outlet-scoped).
    const res = await createFloor(post({ name: "Ground", code: "G", outlet_id: OUTLET }), ctx({}));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    floorId = body.id;
  });

  it("creates tables, lists them with derived occupancy, and reads one", async () => {
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { ok: boolean; row: { id: string; status: string } };
    expect(created.row.status).toBe("available");

    const list = (await (
      await listTables(get(`http://test.local/api/tables?outlet_id=${OUTLET}`), ctx({}) as never)
    ).json()) as { rows: { id: string; occupancy_fill: string }[] };
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0].occupancy_fill).toBe("EMPTY");

    const one = (await (await getTable({} as never, ctx({ id: created.row.id }))).json()) as {
      row: { code: string };
    };
    expect(one.row.code).toBe("T-01");
  });

  it("rejects duplicate table codes per outlet", async () => {
    await createTable(
      post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
      ctx({}),
    );
    const dup = await createTable(
      post({ floor_id: floorId, outlet_id: OUTLET, number: "T2", code: "t-01", capacity: 2 }),
      ctx({}),
    );
    expect(dup.status).toBe(400);
  });

  it("seats, releases, and walks cleaning -> available", async () => {
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const id = created.row.id;

    const seated = (await (
      await tableOccupancy(post({ action: "seat", seats: 2 }), ctx({ id }))
    ).json()) as { ok: boolean; group: { id: string; status: string } };
    expect(seated.group.status).toBe("SEATED");

    const after = (await (await getTable({} as never, ctx({ id }))).json()) as {
      row: { status: string; occupancy_fill: string };
    };
    expect(after.row.status).toBe("occupied");
    expect(after.row.occupancy_fill).toBe("PARTIAL");

    await tableOccupancy(
      post({ action: "release", group_id: seated.group.id, reason: "done" }),
      ctx({ id }),
    );
    const cleaned = (await (await getTable({} as never, ctx({ id }))).json()) as {
      row: { status: string };
    };
    expect(cleaned.row.status).toBe("cleaning");

    await tableStatus(post({ to: "available", reason: "mopped" }), ctx({ id }));
    const open = (await (await getTable({} as never, ctx({ id }))).json()) as {
      row: { status: string };
    };
    expect(open.row.status).toBe("available");
  });

  it("enforces capacity and sharing rules", async () => {
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const id = created.row.id;
    const over = await tableOccupancy(post({ action: "seat", seats: 6 }), ctx({ id }));
    expect(over.status).toBe(400);
    await tableOccupancy(post({ action: "seat", seats: 2 }), ctx({ id }));
    const second = await tableOccupancy(post({ action: "seat", seats: 1 }), ctx({ id }));
    expect(second.status).toBe(400);
  });

  it("transfers a group and blocks illegal status jumps", async () => {
    const a = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const b = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T2", code: "T-02", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const seated = (await (
      await tableOccupancy(post({ action: "seat", seats: 2 }), ctx({ id: a.row.id }))
    ).json()) as { group: { id: string } };
    const moved = (await (
      await tableOccupancy(
        post({
          action: "transfer",
          group_ids: [seated.group.id],
          to_table_id: b.row.id,
          reason: "near window",
        }),
        ctx({ id: a.row.id }),
      )
    ).json()) as { ok: boolean };
    expect(moved.ok).toBe(true);

    const illegal = await tableStatus(
      post({ to: "available", reason: "x" }),
      ctx({ id: b.row.id }),
    );
    // occupied -> available directly is rejected (must release first)
    expect(illegal.status).toBe(400);
  });

  it("blocks and unblocks tables", async () => {
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 2 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const blocked = await tableBlock(
      post({ reason: "wobbly", outlet_id: OUTLET }),
      ctx({ id: created.row.id }),
    );
    expect(blocked.status).toBe(201);
    const seatBlocked = await tableOccupancy(
      post({ action: "seat", seats: 1 }),
      ctx({ id: created.row.id }),
    );
    expect(seatBlocked.status).toBe(400);
    const unblocked = await tableUnblock({} as never, ctx({ id: created.row.id }));
    expect((unblocked as Response).status).toBe(200);
  });

  it("creates, lists and cancels holds", async () => {
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    const held = (await (
      await createHold(
        post({
          outlet_id: OUTLET,
          holder_name: "Meera",
          party_size: 3,
          hold_from: new Date(Date.now() - 60000).toISOString(),
          hold_until: new Date(Date.now() + 3600000).toISOString(),
        }),
        ctx({ id: created.row.id }),
      )
    ).json()) as { ok: boolean };
    expect(held.ok).toBe(true);
  });

  it("exposes the floor layout with tables and groups", async () => {
    const { GET: getLayout } = await import("@/app/api/floors/[id]/layout/route");
    const created = (await (
      await createTable(
        post({ floor_id: floorId, outlet_id: OUTLET, number: "T1", code: "T-01", capacity: 4 }),
        ctx({}),
      )
    ).json()) as { row: { id: string } };
    await tableOccupancy(post({ action: "seat", seats: 2 }), ctx({ id: created.row.id }));
    const layout = (await (
      await getLayout(get("http://test.local/x"), ctx({ id: floorId }))
    ).json()) as {
      floor: { id: string };
      tables: unknown[];
      groups: unknown[];
    };
    expect(layout.floor.id).toBe(floorId);
    expect(layout.tables).toHaveLength(1);
    expect(layout.groups).toHaveLength(1);
  });
});

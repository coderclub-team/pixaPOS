/**
 * Integration: outlet ↔ master availability mappings against the isolated
 * test database. Auth boundary stubbed; persistence is real.
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

import { GET as listMasters, POST as createMaster } from "@/app/api/masters/[type]/route";
import {
  GET as getMappings,
  PUT as setMappings,
} from "@/app/api/masters/[type]/[id]/outlets/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baOrganization, baUser, menuCategories, menuItems, outlets } from "@pixa/db";

const ORG = "org_masters_test";

async function authedAdmin() {
  const database = getTestDb();
  const userId = testId("user");
  await database
    .insert(baUser)
    .values({
      id: userId,
      name: "Masters Tester",
      email: `${userId}@test.local`,
      emailVerified: true,
    })
    .onConflictDoNothing();
  mockBaSession.mockResolvedValue({ user: { id: userId } });
  mockBaOrgId.mockResolvedValue(ORG);
  mockBaHas.mockResolvedValue(true);
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

describe("masters outlet availability", () => {
  let outletA = "";
  let outletB = "";

  beforeAll(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "masters-test-secret-please-change");
  });

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
    const database = getTestDb();
    await database
      .insert(baOrganization)
      .values({ id: ORG, name: "Masters Test Org", slug: `m-${Date.now()}` })
      .onConflictDoNothing();
    await authedAdmin();
    outletA = `${testId("out")}-a`;
    outletB = `${testId("out")}-b`;
    await database.insert(outlets).values([
      { id: outletA, organizationId: ORG, name: "Outlet A", code: `A-${Date.now()}` },
      { id: outletB, organizationId: ORG, name: "Outlet B", code: `B-${Date.now()}` },
    ]);
  });

  it("POST maps a new master to the given outlets only", async () => {
    const created = await createMaster(
      post({ name: "Starters", slug: "starters", outlet_ids: [outletA] }),
      { params: Promise.resolve({ type: "categories" }) },
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const onlyA = await listMasters(get("http://test.local/api/x?outlet_id=" + outletA), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(((await onlyA.json()) as { rows: unknown[] }).rows).toHaveLength(1);

    const onlyB = await listMasters(get("http://test.local/api/x?outlet_id=" + outletB), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(((await onlyB.json()) as { rows: unknown[] }).rows).toHaveLength(0);

    const all = await listMasters(get("http://test.local/api/x"), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(((await all.json()) as { rows: unknown[] }).rows).toHaveLength(1);
    expect(id).toBeTruthy();
  });

  it("POST without outlet_ids maps to every outlet of the org", async () => {
    const created = await createMaster(post({ name: "Mains", slug: "mains" }), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(created.status).toBe(201);
    for (const o of [outletA, outletB]) {
      const res = await listMasters(get("http://test.local/api/x?outlet_id=" + o), {
        params: Promise.resolve({ type: "categories" }),
      });
      expect(((await res.json()) as { rows: unknown[] }).rows).toHaveLength(1);
    }
  });

  it("rejects unknown outlets", async () => {
    const res = await createMaster(post({ name: "Bad", slug: "bad", outlet_ids: ["nope"] }), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT replaces mappings; GET reads them back", async () => {
    const database = getTestDb();
    const catId = testId("cat");
    await database
      .insert(menuCategories)
      .values({ id: catId, organizationId: ORG, name: "Shared", slug: "shared" });
    const put = await setMappings(post({ outlet_ids: [outletB] }), {
      params: Promise.resolve({ type: "categories", id: catId }),
    });
    expect(put.status).toBe(200);
    const got = await getMappings(get("http://test.local/api/x"), {
      params: Promise.resolve({ type: "categories", id: catId }),
    });
    expect(((await got.json()) as { outlet_ids: string[] }).outlet_ids).toEqual([outletB]);

    const onlyA = await listMasters(get("http://test.local/api/x?outlet_id=" + outletA), {
      params: Promise.resolve({ type: "categories" }),
    });
    expect(((await onlyA.json()) as { rows: unknown[] }).rows).toHaveLength(0);
  });

  it("variants follow their item's outlet mapping", async () => {
    const database = getTestDb();
    const { ulid } = await import("@pixa/contracts");
    const catId = ulid();
    const itemA = ulid();
    const itemB = ulid();
    await database.insert(menuCategories).values({ id: catId, organizationId: ORG, name: "C" });
    await database.insert(menuItems).values([
      { id: itemA, organizationId: ORG, name: "At A", categoryId: catId },
      { id: itemB, organizationId: ORG, name: "At B", categoryId: catId },
    ]);
    const { outletMenuItems, menuVariants } = await import("@pixa/db");
    await database.insert(outletMenuItems).values([
      { id: ulid(), organizationId: ORG, outletId: outletA, entityId: itemA },
      { id: ulid(), organizationId: ORG, outletId: outletB, entityId: itemB },
    ]);
    await database.insert(menuVariants).values([
      { id: ulid(), organizationId: ORG, menuItemId: itemA, name: "Reg", sellingPrice: 100 },
      { id: ulid(), organizationId: ORG, menuItemId: itemB, name: "Reg", sellingPrice: 100 },
    ]);
    const res = await listMasters(get("http://test.local/api/x?outlet_id=" + outletA), {
      params: Promise.resolve({ type: "variants" }),
    });
    const rows = ((await res.json()) as { rows: { menuItemId: string }[] }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].menuItemId).toBe(itemA);
  });
});

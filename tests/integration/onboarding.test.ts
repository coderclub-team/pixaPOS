/**
 * Integration: POST /api/onboarding against the isolated test database.
 * Auth is stubbed at the session boundary (vi.mock); everything below it
 * (org/member/profile/outlet/station writes) hits real Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockBaSession } = vi.hoisted(() => ({ mockBaSession: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ baSession: mockBaSession }));
// Route the app's db() at the isolated test database without aliasing
// DATABASE_URL (which would trip the production guard). Schema exports
// pass through untouched.
vi.mock("@pixa/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { getTestDb } = await import("../helpers/db");
  return { ...original, db: () => getTestDb() };
});

import { POST } from "@/app/api/onboarding/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baMember, baOrganization, baUser, outlets, outletKitchenStations } from "@pixa/db";

const TEST_USER = () => ({
  id: testId("user"),
  name: "Test Owner",
  email: `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@test.local`,
});

function authedAs(user: { id: string }) {
  mockBaSession.mockResolvedValue({ user, session: {} });
}

function validBody() {
  return {
    business_name: "Test Bhavan",
    currency: "INR",
    country: "IN",
    timezone: "Asia/Kolkata",
    outlet_name: "Main Counter",
    plan: "starter",
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://test.local/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe("POST /api/onboarding", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
  }, 60_000);

  it("rejects anonymous callers with 401", async () => {
    mockBaSession.mockResolvedValue(null);
    const res = await post(validBody());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "sign-in required" });
  });

  it("rejects malformed JSON with 400", async () => {
    authedAs({ id: "u1" });
    const res = await POST(
      new Request("http://test.local/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{broken",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("requires business and outlet names with 400", async () => {
    authedAs({ id: "u1" });
    const res = await post({ business_name: "", outlet_name: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "business name required" });
  });

  it("enforces the India market lock", async () => {
    authedAs({ id: "u1" });
    const res = await post({
      ...validBody(),
      country: "US",
      currency: "USD",
      timezone: "America/New_York",
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/only onboard Indian/i);
  });

  it("provisions org + admin member + trial + outlet + stations in one transaction", async () => {
    const user = TEST_USER();
    const database = getTestDb();
    await database.insert(baUser).values({ ...user, emailVerified: true });
    authedAs({ id: user.id });

    const res = await post(validBody());
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      organizationId: string;
      slug: string;
      outletId: string;
    };
    expect(data.ok).toBe(true);
    expect(data.slug).toBe("test-bhavan");

    const orgs = await database
      .select()
      .from(baOrganization)
      .where(eq(baOrganization.id, data.organizationId));
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("Test Bhavan");

    const members = await database
      .select()
      .from(baMember)
      .where(eq(baMember.organizationId, data.organizationId));
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(user.id);
    expect(members[0].role).toBe("admin");

    const outs = await database.select().from(outlets).where(eq(outlets.id, data.outletId));
    expect(outs).toHaveLength(1);
    expect(outs[0].name).toBe("Main Counter");

    const stations = await database
      .select()
      .from(outletKitchenStations)
      .where(eq(outletKitchenStations.outletId, data.outletId));
    expect(stations.map((s) => s.code).sort()).toEqual(["BAR", "KITCHEN"]);
  }, 60_000);

  it("suffixes duplicate org slugs instead of failing", async () => {
    const database = getTestDb();
    const mkUser = async () => {
      const user = TEST_USER();
      await database.insert(baUser).values({ ...user, emailVerified: true });
      return user;
    };
    const u1 = await mkUser();
    const u2 = await mkUser();
    authedAs({ id: u1.id });
    const first = (await (await post(validBody())).json()) as { slug: string };
    authedAs({ id: u2.id });
    const second = (await (
      await post({ ...validBody(), outlet_name: "Second Counter" })
    ).json()) as {
      slug: string;
    };
    expect(first.slug).toBe("test-bhavan");
    expect(second.slug).toBe("test-bhavan-2");
  }, 60_000);
});

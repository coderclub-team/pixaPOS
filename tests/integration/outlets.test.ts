/**
 * Integration: POST /api/outlets against the isolated test database.
 * Session + permission boundaries are stubbed; persistence is real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockGetSession, mockBaHas, mockBaOrgId } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockBaHas: vi.fn(),
  mockBaOrgId: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth-session", () => ({ baHas: mockBaHas, baOrgId: mockBaOrgId }));
// Route the app's db() at the isolated test database without aliasing
// DATABASE_URL (which would trip the production guard). Schema exports
// pass through untouched.
vi.mock("@pixa/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { getTestDb } = await import("../helpers/db");
  return { ...original, db: () => getTestDb() };
});

import { POST } from "@/app/api/outlets/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import { baMember, baOrganization, baUser, outlets } from "@pixa/db";

const ORG_ID = () => testId("org");
const USER_ID = () => testId("user");

async function seedOrgWithAdmin(role = "admin") {
  const database = getTestDb();
  const orgId = ORG_ID();
  const user = {
    id: USER_ID(),
    name: "Outlet Tester",
    email: `tester-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@test.local`,
    emailVerified: true,
  };
  await database.insert(baOrganization).values({
    id: orgId,
    name: "Test Org",
    slug: `test-org-${orgId.slice(-8)}`,
    logo: null,
    createdAt: new Date(),
    metadata: "{}",
  });
  await database.insert(baUser).values(user);
  await database.insert(baMember).values({
    id: testId("mem"),
    organizationId: orgId,
    userId: user.id,
    role,
    createdAt: new Date(),
  });
  return { orgId, user };
}

function post(body: unknown) {
  return POST(
    new Request("http://test.local/api/outlets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe("POST /api/outlets", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
  }, 60_000);

  it("rejects anonymous callers with 401", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await post({ name: "Main" });
    expect(res.status).toBe(401);
  });

  it("rejects short names with 400 before touching the DB", async () => {
    const { user } = await seedOrgWithAdmin();
    mockGetSession.mockResolvedValue({ user: { id: user.id } });
    const res = await post({ name: "x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name required (min 2)" });
  });

  it("rejects non-managers with 403", async () => {
    const { user, orgId } = await seedOrgWithAdmin("cashier");
    mockGetSession.mockResolvedValue({ user: { id: user.id } });
    mockBaHas.mockResolvedValue(false);
    mockBaOrgId.mockResolvedValue(orgId);
    const res = await post({ name: "Main Counter" });
    expect(res.status).toBe(403);
  });

  it("creates the outlet with derived code and seeds stations (201)", async () => {
    const { user, orgId } = await seedOrgWithAdmin();
    mockGetSession.mockResolvedValue({ user: { id: user.id } });
    mockBaHas.mockResolvedValue(true);
    mockBaOrgId.mockResolvedValue(orgId);

    const res = await post({ name: "Main Counter" });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; id: string; code: string };
    expect(data.ok).toBe(true);
    expect(data.code).toBe("MAINCO");

    const database = getTestDb();
    const rows = await database.select().from(outlets).where(eq(outlets.id, data.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe(orgId);
    expect(rows[0].isActive).toBe(true);
  }, 60_000);

  it("suffixes colliding codes instead of failing", async () => {
    const { user, orgId } = await seedOrgWithAdmin();
    mockGetSession.mockResolvedValue({ user: { id: user.id } });
    mockBaHas.mockResolvedValue(true);
    mockBaOrgId.mockResolvedValue(orgId);

    const first = (await (await post({ name: "Main Counter" })).json()) as { code: string };
    const second = (await (await post({ name: "Main Counter!!" })).json()) as { code: string };
    expect(first.code).toBe("MAINCO");
    expect(second.code).toBe("MAINCO2");
  }, 60_000);
});

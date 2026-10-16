import { describe, expect, it, vi } from "vitest";

const { mockBaUser, mockGetOwnerSession } = vi.hoisted(() => ({
  mockBaUser: vi.fn(),
  mockGetOwnerSession: vi.fn(),
}));

vi.mock("@pixa/server", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, getOwnerSession: mockGetOwnerSession, baUser: mockBaUser };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import AdminLandingPage from "../../apps/admin/app/page";

async function destination(): Promise<string> {
  try {
    await AdminLandingPage();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/^NEXT_REDIRECT:(.+)$/);
    if (m) return m[1];
    throw e;
  }
  throw new Error("expected a redirect");
}

describe("/admin landing (standalone admin app URL space)", () => {
  it("sends owners to the console home", async () => {
    mockGetOwnerSession.mockResolvedValue({ email: "owner@pixa.pos" });
    await expect(destination()).resolves.toBe("/organizations");
  });

  it("sends restaurant users to the web dashboard", async () => {
    mockGetOwnerSession.mockResolvedValue(null);
    mockBaUser.mockResolvedValue({ id: "u1" });
    const dest = await destination();
    expect(dest.endsWith("/dashboard")).toBe(true);
  });

  it("sends anonymous visitors to owner login", async () => {
    mockGetOwnerSession.mockResolvedValue(null);
    mockBaUser.mockResolvedValue(null);
    await expect(destination()).resolves.toBe("/login");
  });
});

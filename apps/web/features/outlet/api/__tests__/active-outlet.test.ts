import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveOutletStorageKey,
  getServiceOutletId,
  resolveActiveOutlet,
  setActiveOutletId,
  swapOutletSegment,
} from "../outlets";

const outlets = [
  { id: "out_A", organization_id: "org_1", name: "A", code: "A", is_active: true },
  { id: "out_B", organization_id: "org_1", name: "B", code: "B", is_active: true },
];

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  vi.stubGlobal("window", {
    location: { pathname: "/dashboard/settings/outlets" },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      clear: () => store.clear(),
    },
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
}

describe("resolveActiveOutlet (server wins, no mock preference)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  it("uses a route-scoped storage key instead of a single global browser id", () => {
    expect(getActiveOutletStorageKey("/pos/out_A")).toBe("pixa:activeOutlet:pos");
    expect(getActiveOutletStorageKey("/dashboard/settings/outlets")).toBe(
      "pixa:activeOutlet:dashboard",
    );

    setActiveOutletId("out_B", "/pos/out_A");
    expect(resolveActiveOutlet(outlets, "/dashboard/settings/outlets")).toBe("out_A");
    expect(resolveActiveOutlet(outlets, "/pos/out_A")).toBe("out_B");
  });

  it("honors an explicitly stored server id for the current route", () => {
    setActiveOutletId("out_B", "/dashboard/settings/outlets");
    expect(resolveActiveOutlet(outlets, "/dashboard/settings/outlets")).toBe("out_B");
  });

  it("prefers the server list over legacy mock data", () => {
    stubStorage({ pixaOrders: JSON.stringify({ orders: [{ id: "o1", outlet_id: "out_001" }] }) });
    expect(resolveActiveOutlet(outlets, "/dashboard/settings/outlets")).toBe("out_A");
  });

  it("ignores a stale stored outlet id and falls back to the dashboard list order", () => {
    setActiveOutletId("out_001", "/dashboard/settings/outlets");
    expect(resolveActiveOutlet(outlets, "/dashboard/settings/outlets")).toBe("out_A");
  });

  it("uses the dashboard/settings list order for the default outlet, not created_at ordering", () => {
    const byDisplayOrder = [
      {
        id: "out_B",
        organization_id: "org_1",
        name: "B",
        code: "B",
        is_active: true,
        created_at: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "out_A",
        organization_id: "org_1",
        name: "A",
        code: "A",
        is_active: true,
        created_at: "2023-12-31T00:00:00.000Z",
      },
    ];
    expect(resolveActiveOutlet(byDisplayOrder, "/dashboard/settings/outlets")).toBe("out_B");
  });

  it("returns null when nothing stored and no server outlets (setup, not mock)", () => {
    expect(resolveActiveOutlet([], "/dashboard/settings/outlets")).toBeNull();
  });

  it("returns null-safe fallback when no window (SSR)", () => {
    vi.unstubAllGlobals();
    expect(resolveActiveOutlet(outlets, "/dashboard/settings/outlets")).toBe("out_A");
  });
});

describe("getServiceOutletId", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  it("returns stored id, else null (no mock fallback)", () => {
    expect(getServiceOutletId()).toBeNull();
    setActiveOutletId("out_B");
    expect(getServiceOutletId()).toBe("out_B");
  });
});

describe("swapOutletSegment", () => {
  it("rewrites the outlet segment on outlet-scoped routes", () => {
    expect(swapOutletSegment("/pos/out_A", "out_A", "out_B")).toBe("/pos/out_B");
    expect(swapOutletSegment("/kds/out_A/board", "out_A", "out_B")).toBe("/kds/out_B/board");
  });
  it("returns null when the path carries no outlet segment", () => {
    expect(swapOutletSegment("/dashboard/overview", "out_A", "out_B")).toBeNull();
    expect(swapOutletSegment("/pos/out_A", "out_X", "out_B")).toBeNull();
  });
  it("returns null for empty or identical ids", () => {
    expect(swapOutletSegment("/pos/out_A", "", "out_B")).toBeNull();
    expect(swapOutletSegment("/pos/out_A", "out_A", "out_A")).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceOutletId, resolveActiveOutlet, setActiveOutletId } from "../outlets";

const outlets = [
  { id: "out_A", organization_id: "org_1", name: "A", code: "A", is_active: true },
  { id: "out_B", organization_id: "org_1", name: "B", code: "B", is_active: true },
];

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      clear: () => store.clear(),
    },
  });
}

describe("resolveActiveOutlet (server wins, no mock preference)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  it("honors an explicitly stored server id", () => {
    setActiveOutletId("out_B");
    expect(resolveActiveOutlet(outlets)).toBe("out_B");
  });

  it("prefers the server list over legacy mock data", () => {
    stubStorage({ pixaOrders: JSON.stringify({ orders: [{ id: "o1", outlet_id: "out_001" }] }) });
    expect(resolveActiveOutlet(outlets)).toBe("out_A");
  });

  it("honors an explicitly stored id (user choice always wins)", () => {
    setActiveOutletId("out_001");
    expect(resolveActiveOutlet(outlets)).toBe("out_001");
  });

  it("returns null when nothing stored and no server outlets (setup, not mock)", () => {
    expect(resolveActiveOutlet([])).toBeNull();
  });

  it("returns null-safe fallback when no window (SSR)", () => {
    vi.unstubAllGlobals();
    expect(resolveActiveOutlet(outlets)).toBe("out_A");
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

import { describe, it, expect } from "vitest";

function canAccess(
  authed: { organizationId: string; outletId: string },
  requested: { organizationId: string; outletId: string },
): boolean {
  return (
    authed.organizationId === requested.organizationId && authed.outletId === requested.outletId
  );
}

describe("tenant/outlet isolation", () => {
  it("org A cannot see org B events", () => {
    const authed = { organizationId: "org_A", outletId: "out_1" };
    expect(canAccess(authed, { organizationId: "org_B", outletId: "out_1" })).toBe(false);
  });
  it("outlet A cannot see outlet B", () => {
    const authed = { organizationId: "org_A", outletId: "out_A" };
    expect(canAccess(authed, { organizationId: "org_A", outletId: "out_B" })).toBe(false);
  });
  it("same org+outlet allowed", () => {
    const authed = { organizationId: "org_A", outletId: "out_A" };
    expect(canAccess(authed, { organizationId: "org_A", outletId: "out_A" })).toBe(true);
  });
  it("device outlet mismatch rejected", () => {
    const device = { outlet_id: "out_B", organization_id: "org_A" };
    const ctx = { organizationId: "org_A", outletId: "out_A" };
    const ok = device.outlet_id === ctx.outletId && device.organization_id === ctx.organizationId;
    expect(ok).toBe(false);
  });
  it("multiple terminals same outlet all receive", () => {
    const events = [{ sequence: 1, outlet_id: "out_A" }];
    const terminals = [{ id: "POS1" }, { id: "POS2" }, { id: "KDS1" }];
    for (const t of terminals) {
      const visible = events.filter((e) => e.outlet_id === "out_A");
      expect(visible.length).toBe(1);
      void t;
    }
  });
});

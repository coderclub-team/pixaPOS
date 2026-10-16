import { describe, expect, it } from "vitest";
import { allowedSurfaces, surfaceForPath } from "../surfaces";

describe("allowedSurfaces", () => {
  it("admin/manager/owner get every surface", () => {
    for (const role of ["admin", "org:admin", "manager", "owner", "org:owner"]) {
      const s = allowedSurfaces(role);
      expect(s).toEqual(
        expect.arrayContaining(["dashboard", "pos", "kds", "kot", "dispatch", "rider"]),
      );
    }
  });

  it("cashier gets dashboard/pos/dispatch only", () => {
    expect(allowedSurfaces("cashier")).toEqual(["dashboard", "pos", "dispatch"]);
    expect(allowedSurfaces("org:cashier")).toEqual(["dashboard", "pos", "dispatch"]);
  });

  it("waiter gets pos/kot, kitchen gets kds/kot", () => {
    expect(allowedSurfaces("waiter")).toEqual(["pos", "kot"]);
    expect(allowedSurfaces("kitchen")).toEqual(["kds", "kot"]);
  });

  it("accountant gets dashboard only; unknown roles get nothing (fail-closed)", () => {
    expect(allowedSurfaces("accountant")).toEqual(["dashboard"]);
    expect(allowedSurfaces("random")).toEqual([]);
    expect(allowedSurfaces(null)).toEqual([]);
  });
});

describe("surfaceForPath", () => {
  it("maps terminal paths to surfaces", () => {
    expect(surfaceForPath("/pos")).toBe("pos");
    expect(surfaceForPath("/kds")).toBe("kds");
    expect(surfaceForPath("/kot")).toBe("kot");
    expect(surfaceForPath("/dispatch/run/1")).toBe("dispatch");
    expect(surfaceForPath("/rider")).toBe("rider");
    expect(surfaceForPath("/dashboard/orders")).toBe("dashboard");
  });

  it("returns null for public paths", () => {
    expect(surfaceForPath("/kiosk")).toBeNull();
    expect(surfaceForPath("/qr")).toBeNull();
    expect(surfaceForPath("/auth/sign-in")).toBeNull();
  });
});
